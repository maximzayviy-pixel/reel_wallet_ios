// pages/api/roulette-spin.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const COST = 15;

// Если у тебя другая таблица истории — переопредели через ENV
const LEDGER_TABLE = process.env.LEDGER_TABLE_NAME || "ledger";
const LEDGER_TG_FIELD = process.env.LEDGER_TG_FIELD_NAME || "tg_id";

// Тот же набор призов, что в UI
const PRIZES: Array<
  | { kind: "stars"; label: string; value: number; weight: number }
  | { kind: "nft"; label: string; image: string; weight: number }
> = [
  { kind: "stars", label: "+3", value: 3, weight: 30 },
  { kind: "stars", label: "+5", value: 5, weight: 24 },
  { kind: "stars", label: "+10", value: 10, weight: 18 },
  { kind: "stars", label: "+15", value: 15, weight: 12 },
  { kind: "stars", label: "+50", value: 50, weight: 8 },
  { kind: "stars", label: "+100", value: 100, weight: 5.5 },
  { kind: "stars", label: "+1000", value: 1000, weight: 2.4 },
  { kind: "nft", label: "Plush Pepe NFT", image: "https://i.imgur.com/BmoA5Ui.jpeg", weight: 0.1 },
];

function pickPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PRIZES[0];
}

function readTgId(req: NextApiRequest) {
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
  return tg_id;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const tg_id = readTgId(req);
  if (!tg_id || Number.isNaN(tg_id)) {
    return res.status(400).json({ ok: false, error: "NO_TG_ID" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!, // service key, server-only
    { auth: { persistSession: false } }
  );

  try {
    // 1) Берём баланс из той же вьюхи, что и /api/my-balance
    const starsBefore = await getStarsFromView(supabase, tg_id);
    if (starsBefore < COST) {
      return res.status(400).json({ ok: false, error: "NOT_ENOUGH_STARS", balance: starsBefore, tg_id });
    }

    // 2) Разыгрываем приз
    const prize = pickPrize();

    // 3) Пишем две операции в историю (списание + приз) — с авто-детектом доступных колонок
    await insertLedgerSafe(supabase, {
      tg_id,
      delta: -COST,
      label: "roulette_cost",
      meta: { game: "roulette" },
    });

    if (prize.kind === "stars") {
      await insertLedgerSafe(supabase, {
        tg_id,
        delta: prize.value,
        label: "roulette_prize",
        meta: { label: prize.label },
      });
    } else {
      // NFT — без изменения баланса, просто фиксация события
      await insertLedgerSafe(supabase, {
        tg_id,
        delta: 0,
        label: "nft_reward",
        meta: { label: prize.label, image: (prize as any).image, game: "roulette" },
      });
    }

    // 4) Новый баланс — снова через ту же вьюху
    const starsAfter = await getStarsFromView(supabase, tg_id);

    return res.status(200).json({
      ok: true,
      prize: prize.kind === "stars" ? { type: "stars", value: prize.value } : { type: "nft" },
      balance: starsAfter,
      tg_id,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "SPIN_FAILED", message: e?.message ?? "Unknown error" });
  }
}

/** Читает баланс звёзд из balances_by_tg (как и /api/my-balance) */
async function getStarsFromView(supabase: any, tg_id: number): Promise<number> {
  const { data, error } = await supabase
    .from("balances_by_tg")
    .select("stars")
    .eq("tg_id", tg_id)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.stars || 0);
}

/**
 * Универсальная вставка в историю:
 * - пробует { delta, type } → если нет таких колонок, пробует { amount, reason }
 * - всегда добавляет JSON meta, если колонка поддерживается
 */
async function insertLedgerSafe(
  supabase: any,
  opts: { tg_id: number; delta: number; label: string; meta?: Record<string, any> }
) {
  // Вариант №1: delta + type + meta
  const row1: Record<string, any> = { [LEDGER_TG_FIELD]: opts.tg_id, delta: opts.delta, type: opts.label, meta: opts.meta ?? {} };
  let { error } = await supabase.from(LEDGER_TABLE).insert(row1);
  if (!error) return;

  // Вариант №2: amount + reason + meta
  const row2: Record<string, any> = { [LEDGER_TG_FIELD]: opts.tg_id, amount: opts.delta, reason: opts.label, meta: opts.meta ?? {} };
  ({ error } = await supabase.from(LEDGER_TABLE).insert(row2));
  if (!error) return;

  // Вариант №3: только amount (минимум)
  const row3: Record<string, any> = { [LEDGER_TG_FIELD]: opts.tg_id, amount: opts.delta };
  ({ error } = await supabase.from(LEDGER_TABLE).insert(row3));
  if (!error) return;

  // Если все попытки провалились — бросаем последнюю ошибку вверх
  throw error;
}
