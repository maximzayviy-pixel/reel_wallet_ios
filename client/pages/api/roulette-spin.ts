// pages/api/roulette-spin.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const PRIZES = [
  { label: "-5", value: -5, weight: 38, rarity: "обычный" },
  { label: "-10", value: -10, weight: 25, rarity: "обычный" },
  { label: "-15", value: -15, weight: 15, rarity: "обычный" },
  { label: "-20", value: -20, weight: 10, rarity: "обычный" },
  { label: "-50", value: -50, weight: 7, rarity: "редкий" },
  { label: "-100", value: -100, weight: 4.9, rarity: "очень редкий" },
  { label: "+10000", value: 10000, weight: 0.1, rarity: "мега супер редкий" },
] as const;

const COST_PER_SPIN = 15;

function pickByWeight() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  // криптографический рандом
  const r = (Number(crypto.randomBytes(6).readUIntBE(0, 6)) / 2 ** 48) * total;
  let acc = 0;
  for (const p of PRIZES) {
    acc += p.weight;
    if (r <= acc) return p;
  }
  return PRIZES[0];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // TODO: проверь initData Telegram / сессию и вытащи tg_id пользователя
  const tg_id = /* ваш способ аутентификации */ req.headers["x-tg-id"];
  if (!tg_id) return res.status(401).json({ error: "Unauthorized" });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  // Транзакцию удобнее сделать через RPC (sql function) — тут псевдо-atomic шаги:
  try {
    // 1) проверяем текущий баланс
    const { data: balView, error: balErr } = await supabase
      .rpc("get_balance_by_tg", { in_tg_id: tg_id }); // создайте такую RPC или используйте свою
    if (balErr) throw balErr;
    const balance = balView?.balance ?? 0;
    if (balance < COST_PER_SPIN) return res.status(400).json({ error: "NOT_ENOUGH_STARS" });

    // 2) списываем 15
    const { error: debitErr } = await supabase.from("ledger").insert({
      tg_id,
      amount_stars: -COST_PER_SPIN,
      source: "roulette_spin_cost",
      meta: {}
    });
    if (debitErr) throw debitErr;

    // 3) выбираем приз и применяем дельту
    const prize = pickByWeight();
    if (prize.value !== 0) {
      const { error: deltaErr } = await supabase.from("ledger").insert({
        tg_id,
        amount_stars: prize.value,
        source: "roulette_prize",
        meta: { label: prize.label, rarity: prize.rarity }
      });
      if (deltaErr) throw deltaErr;
    }

    // 4) новый баланс
    const { data: balAfter, error: balAfterErr } = await supabase
      .rpc("get_balance_by_tg", { in_tg_id: tg_id });
    if (balAfterErr) throw balAfterErr;

    res.json({
      prize,
      balance: balAfter?.balance ?? 0,
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: "SPIN_FAILED" });
  }
}
