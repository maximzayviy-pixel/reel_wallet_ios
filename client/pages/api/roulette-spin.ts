// client/pages/api/roulette-spin.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const COST_PER_SPIN = 15;

// Позволяет гибко подстроиться под схему БД через ENV
const LEDGER_TABLE = process.env.LEDGER_TABLE_NAME || "ledger";
const LEDGER_TG_FIELD = process.env.LEDGER_TG_FIELD_NAME || "tg_id"; // если у тебя user_id — задай env
const BALANCES_TABLE = process.env.BALANCES_TABLE_NAME || "balances";
const BALANCES_TG_FIELD = process.env.BALANCES_TG_FIELD_NAME || "tg_id";

type Prize =
  | { type: "stars"; label: string; value: number; weight: number }
  | { type: "nft"; label: string; image: string; weight: number };

// Пул призов и «веса» (≈ шансы в %)
const PRIZES: Prize[] = [
  { type: "stars", label: "+3", value: 3, weight: 20 },
  { type: "stars", label: "+5", value: 5, weight: 14 },
  { type: "stars", label: "+10", value: 10, weight: 8 },
  { type: "stars", label: "+15", value: 15, weight: 10 },
  { type: "stars", label: "+50", value: 50, weight: 5 },
  { type: "stars", label: "+100", value: 100, weight: 3.5 },
  { type: "stars", label: "+1000", value: 1000, weight: 1.4 },
  { type: "nft", label: "Plush Pepe NFT", image: "https://i.imgur.com/BmoA5Ui.jpeg", weight: 0.01 },
];
const TOTAL_WEIGHT = PRIZES.reduce((s, p) => s + p.weight, 0);

function pickPrize(): Prize {
  const r = (Number(crypto.randomBytes(6).readUIntBE(0, 6)) / 2 ** 48) * TOTAL_WEIGHT;
  let acc = 0;
  for (const p of PRIZES) { acc += p.weight; if (r <= acc) return p; }
  return PRIZES[0];
}

// ——— баланс как на фронте: сначала balances, потом RPC ———
async function getBalanceUnified(supabase: any, tg_id: number) {
  // 1) balances (как у /api/my-balance)
  try {
    const { data, error } = await supabase
      .from(BALANCES_TABLE)
      .select("*")
      .eq(BALANCES_TG_FIELD, tg_id)
      .single();
    if (!error && data) {
      const maybe = Number(
        (data as any).balance ??
        (data as any).stars ??
        (data as any).amount ??
        0
      );
      if (!Number.isNaN(maybe)) return maybe;
    }
  } catch {}

  // 2) fallback — RPC (тип RPC параметров приводим к any, чтобы не падал TS)
  try {
    const { data, error } = await (supabase as any).rpc("get_balance_by_tg", { p_tg_id: tg_id });
    if (error) throw error;
    const maybe = Number((data as any)?.balance ?? (data as any) ?? 0);
    if (!Number.isNaN(maybe)) return maybe;
  } catch {}

  return 0;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  // Приоритет: x-tg-id → тело → x-init-data (Telegram)
  const initData = (req.headers["x-init-data"] as string) || (req.headers["x-telegram-init-data"] as string) || "";
  const headerTg = (req.headers["x-tg-id"] as string) || "";
  const bodyVal = (req.body && (req.body.tg_id ?? req.body.tgId)) as string | number | undefined;
  const bodyTg = bodyVal != null && String(bodyVal).trim() !== "" ? Number(bodyVal) : 0;

  let tg_id = headerTg ? Number(headerTg) : bodyTg;
  try {
    if (!tg_id && initData) {
      const enc = encodeURIComponent(initData);
      const m = /user=%7B%22id%22%3A(\d+)/.exec(enc);
      if (m) tg_id = Number(m[1]);
    }
  } catch {}

  if (!tg_id || Number.isNaN(tg_id)) {
    return res.status(400).json({ ok: false, error: "NO_TG_ID" });
  }

  const supabase: any = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false },
  });

  try {
    // 1) Баланс ДО (как у фронта)
    const balanceBefore = await getBalanceUnified(supabase, tg_id);
    if (balanceBefore < COST_PER_SPIN) {
      return res.status(400).json({ ok: false, error: "NOT_ENOUGH_STARS", balance: balanceBefore, tg_id });
    }

    // 2) Списываем стоимость игры
    const debitRow: Record<string, any> = {
      delta: -COST_PER_SPIN,
      type: "roulette_cost",
      meta: { game: "roulette" },
    };
    debitRow[LEDGER_TG_FIELD] = tg_id;

    const { error: debitErr } = await supabase.from(LEDGER_TABLE).insert(debitRow);
    if (debitErr) throw debitErr;

    // 3) Выбираем приз
    const prize = pickPrize();

    // 4) Начисляем приз
    const prizeRow: Record<string, any> = {
      delta: prize.type === "stars" ? prize.value : 0,
      type: prize.type === "stars" ? "roulette_prize" : "nft_reward",
      meta: prize.type === "stars"
        ? { label: prize.label }
        : { label: prize.label, image: prize.image, game: "roulette" },
    };
    prizeRow[LEDGER_TG_FIELD] = tg_id;

    const { error: prizeErr } = await supabase.from(LEDGER_TABLE).insert(prizeRow);
    if (prizeErr) throw prizeErr;

    // 5) Баланс ПОСЛЕ (тем же способом, что и фронт)
    const balanceAfter = await getBalanceUnified(supabase, tg_id);

    return res.status(200).json({ ok: true, prize, balance: balanceAfter, tg_id });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "SPIN_FAILED" });
  }
}
