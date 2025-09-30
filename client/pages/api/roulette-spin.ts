// pages/api/roulette-spin.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Ok = { ok: true; prize: number | "PLUSH_PEPE_NFT"; balance: number; tg_id: number };
type Err = { ok: false; error: string; details?: string; balance?: number; tg_id?: number };

const COST = 15;
const LEDGER_TABLE = process.env.LEDGER_TABLE_NAME || "ledger";
const LEDGER_TG_FIELD = process.env.LEDGER_TG_FIELD_NAME || "tg_id";

const PRIZES: Array<{ value: number | "PLUSH_PEPE_NFT"; weight: number }> = [
  { value: 3, weight: 30 },
  { value: 5, weight: 24 },
  { value: 10, weight: 18 },
  { value: 15, weight: 12 },
  { value: 50, weight: 8 },
  { value: 100, weight: 5.5 },
  { value: 1000, weight: 2.4 },
  { value: "PLUSH_PEPE_NFT", weight: 0.1 },
];

function pickPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    r -= p.weight;
    if (r <= 0) return p.value;
  }
  return PRIZES[0].value;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const tg_id = readTgId(req);
  if (!tg_id || Number.isNaN(tg_id)) return res.status(400).json({ ok: false, error: "NO_TG_ID" });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false },
  }) as any;

  // баланс из balances_by_tg — как в /api/my-balance
  const starsBefore = await getStars(supabase, tg_id).catch(() => NaN);
  if (!Number.isFinite(starsBefore)) {
    return res.status(500).json({ ok: false, error: "BALANCE_QUERY_FAILED", tg_id });
  }
  if (starsBefore < COST) {
    return res.status(400).json({ ok: false, error: "NOT_ENOUGH_STARS", balance: starsBefore, tg_id });
  }

  try {
    const prize = pickPrize();
    const delta = typeof prize === "number" ? prize - COST : -COST;

    // ⚙️ вставка в ledger с поддержкой разных схем; всегда стараемся писать type
    await insertLedgerSmart(supabase, {
      table: LEDGER_TABLE,
      tgField: LEDGER_TG_FIELD,
      tg_id,
      delta,
      typeValue: typeof prize === "number" ? "roulette_prize_stars" : "roulette_prize_nft",
    });

    if (prize === "PLUSH_PEPE_NFT") {
      // не обязательная таблица — тихая попытка
      try {
        await supabase.from("gifts_claims").insert([
          { tg_id, gift_code: "PLUSH_PEPE_NFT", title: "Plush Pepe NFT", image_url: "https://i.imgur.com/BmoA5Ui.jpeg", status: "pending" },
        ]);
      } catch {}
    }

    const starsAfter = await getStars(supabase, tg_id).catch(() => starsBefore + delta);
    return res.status(200).json({ ok: true, prize, balance: starsAfter, tg_id });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: "SPIN_FAILED",
      details: e?.message || String(e),
      balance: starsBefore,
      tg_id,
    });
  }
}

async function getStars(supabase: any, tg_id: number): Promise<number> {
  const { data, error } = await supabase.from("balances_by_tg").select("stars").eq("tg_id", tg_id).maybeSingle();
  if (error) throw error;
  return Number(data?.stars || 0);
}

/**
 * Пытаемся по порядку:
 *  A) { delta, type }         — если есть delta и NOT NULL type
 *  B) { amount, type }        — если delta нет, но есть amount и NOT NULL type
 *  C) { delta }               — если type-колонки нет вообще
 *  D) { amount }              — если нет ни type, ни delta
 */
async function insertLedgerSmart(
  supabase: any,
  opts: { table: string; tgField: string; tg_id: number; delta: number; typeValue: string }
) {
  const base = { [opts.tgField]: opts.tg_id };

  // A) delta + type
  let { error } = await supabase.from(opts.table).insert([{ ...base, delta: opts.delta, type: opts.typeValue }]);
  if (!error) return;

  const msg = String(error?.message || "").toLowerCase();

  // если ругается, что delta не существует — пробуем amount + type
  if (msg.includes('column "delta"') || msg.includes("delta column")) {
    ({ error } = await supabase.from(opts.table).insert([{ ...base, amount: opts.delta, type: opts.typeValue }]));
    if (!error) return;
  }

  // если ругается, что type не существует — пробуем без type
  if (msg.includes('column "type"') || msg.includes("type column")) {
    // C) delta
    ({ error } = await supabase.from(opts.table).insert([{ ...base, delta: opts.delta }]));
    if (!error) return;

    // D) amount
    ({ error } = await supabase.from(opts.table).insert([{ ...base, amount: opts.delta }]));
    if (!error) return;
  }

  // Если мы сюда дошли — повторно попытаться разумным альтернативным вариантом:
  // попробуем amount + type (если это не мы уже пробовали выше)
  if (!msg.includes('column "type"')) {
    ({ error } = await supabase.from(opts.table).insert([{ ...base, amount: opts.delta, type: opts.typeValue }]));
    if (!error) return;
  }

  throw new Error(error?.message || "ledger insert failed");
}
