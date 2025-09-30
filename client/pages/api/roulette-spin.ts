import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const COST_PER_SPIN = 15;

// ENV-переменные для гибкой схемы
const LEDGER_TABLE = process.env.LEDGER_TABLE_NAME || "ledger";
const LEDGER_TG_FIELD = process.env.LEDGER_TG_FIELD_NAME || "tg_id";

type Prize =
  | { type: "stars"; label: string; value: number; weight: number }
  | { type: "nft"; label: string; image: string; weight: number };

const PRIZES: Prize[] = [
  { type: "stars", label: "+3", value: 3, weight: 30 },
  { type: "stars", label: "+5", value: 5, weight: 24 },
  { type: "stars", label: "+10", value: 10, weight: 18 },
  { type: "stars", label: "+15", value: 15, weight: 12 },
  { type: "stars", label: "+50", value: 50, weight: 8 },
  { type: "stars", label: "+100", value: 100, weight: 5.5 },
  { type: "stars", label: "+1000", value: 1000, weight: 2.4 },
  { type: "nft", label: "Plush Pepe NFT", image: "https://i.imgur.com/BmoA5Ui.jpeg", weight: 0.1 },
];
const TOTAL_WEIGHT = PRIZES.reduce((s, p) => s + p.weight, 0);

function pickPrize(): Prize {
  const r = (Number(crypto.randomBytes(6).readUIntBE(0, 6)) / 2 ** 48) * TOTAL_WEIGHT;
  let acc = 0;
  for (const p of PRIZES) { acc += p.weight; if (r <= acc) return p; }
  return PRIZES[0];
}

/** 1) Главный способ: запросить /api/my-balance (ровно та же логика, что у фронта) */
async function getBalanceViaApi(req: NextApiRequest, tg_id: number) {
  try {
    const proto =
      (req.headers["x-forwarded-proto"] as string) ||
      (process.env.VERCEL_URL ? "https" : "http");
    const host =
      (req.headers["x-forwarded-host"] as string) ||
      (req.headers.host as string) ||
      process.env.VERCEL_URL;

    if (!host) return null;

    const url = `${proto}://${host}/api/my-balance?tg_id=${tg_id}`;
    const r = await fetch(url, {
      headers: {
        "x-init-data": (req.headers["x-init-data"] as string) || "",
        "x-tg-id": String(tg_id),
      } as any,
      // Vercel Edge/Node допускает внутренний fetch
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null as any);
    if (!j) return null;

    // Нормализуем поле: у разных реализаций бывает stars/balance/amount
    const val = Number(j?.stars ?? j?.balance ?? j?.amount ?? j);
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

/** 2) Фолбэк: Supabase — balances/ RPC/ и т.д.  */
async function getBalanceFallback(supabase: any, tg_id: number) {
  // Попробуем популярные источники:
  const candidates = [
    { table: process.env.BALANCES_TABLE_NAME || "balances", idField: process.env.BALANCES_TG_FIELD_NAME || "tg_id" },
    { table: "users", idField: "tg_id" },
    { table: "profiles", idField: "tg_id" },
    { table: "stars_balance", idField: "tg_id" },
  ];

  for (const c of candidates) {
    try {
      const { data, error } = await supabase.from(c.table).select("*").eq(c.idField, tg_id).maybeSingle();
      if (!error && data) {
        const val = Number((data as any).stars ?? (data as any).balance ?? (data as any).amount ?? 0);
        if (Number.isFinite(val)) return val;
      }
    } catch {}
  }

  // Последний шанс — RPC get_balance_by_tg(p_tg_id)
  try {
    const { data, error } = await (supabase as any).rpc("get_balance_by_tg", { p_tg_id: tg_id });
    if (!error && data != null) {
      const val = Number((data as any)?.balance ?? (data as any) ?? 0);
      if (Number.isFinite(val)) return val;
    }
  } catch {}

  return 0;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  // Приоритет источников tg_id: заголовок → тело → x-init-data (Telegram)
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
    // 1) Баланс ДО: сначала — через ваш /api/my-balance
    const balanceFromApi = await getBalanceViaApi(req, tg_id);
    const balanceBefore = balanceFromApi ?? (await getBalanceFallback(supabase, tg_id));

    if (balanceBefore < COST_PER_SPIN) {
      return res.status(400).json({ ok: false, error: "NOT_ENOUGH_STARS", balance: balanceBefore, tg_id });
    }

    // 2) Списываем 15⭐
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

    // 5) Баланс ПОСЛЕ — тем же путём, что и ДО
    const balanceAfterApi = await getBalanceViaApi(req, tg_id);
    const balanceAfter = balanceAfterApi ?? (await getBalanceFallback(supabase, tg_id));

    return res.status(200).json({ ok: true, prize, balance: balanceAfter, tg_id });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "SPIN_FAILED" });
  }
}
