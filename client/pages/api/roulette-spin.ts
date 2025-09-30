// pages/api/roulette-spin.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Ok = { ok: true; prize: number | "PLUSH_PEPE_NFT"; balance: number; tg_id: number };
type Err = { ok: false; error: string; details?: string; balance?: number; tg_id?: number };

const COST = 15;

// шансы те же, что в UI
const PRIZES: Array<{ value: number | "PLUSH_PEPE_NFT"; weight: number }> = [
  { value: 3, weight: 30 },
  { value: 5, weight: 19 },
  { value: 10, weight: 13 },
  { value: 15, weight: 9 },
  { value: 50, weight: 4 },
  { value: 100, weight: 3.5 },
  { value: 1000, weight: 1.4 },
  { value: "PLUSH_PEPE_NFT", weight: 0.01 },
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

  // 1) баланс до — как в /api/my-balance
  const starsBefore = await getStars(supabase, tg_id).catch(() => NaN);
  if (!Number.isFinite(starsBefore)) return res.status(500).json({ ok: false, error: "BALANCE_QUERY_FAILED", tg_id });
  if (starsBefore < COST) return res.status(400).json({ ok: false, error: "NOT_ENOUGH_STARS", balance: starsBefore, tg_id });

  try {
    // 2) розыгрыш
    const prize = pickPrize();
    const delta = typeof prize === "number" ? prize - COST : -COST; // изменение в звёздах

    // 3) одна запись в ledger (строго по схеме, которую ты прислал)
    // обязательные поля: type (NOT NULL), amount_rub (NOT NULL)
    // delta/amount у тебя есть и они NULLABLE — используем amount
    const row: any = {
      tg_id,
      type: typeof prize === "number" ? "roulette_prize_stars" : "roulette_prize_nft",
      amount: delta,           // изменение баланса в звёздах
      amount_rub: 0,           // у тебя NOT NULL
      status: "done",          // есть default, но можем явно указать
      // metadata: { source: "roulette" }, // опционально: если хочешь
    };

    const { error: insErr } = await supabase.from("ledger").insert([row]);
    if (insErr) throw new Error(insErr.message);

    // 4) (опционально) фиксируем NFT-выигрыш
    if (prize === "PLUSH_PEPE_NFT") {
      try {
        await supabase.from("gifts_claims").insert([
          {
            tg_id,
            gift_code: "PLUSH_PEPE_NFT",
            title: "Plush Pepe NFT",
            image_url: "https://i.imgur.com/BmoA5Ui.jpeg",
            status: "pending",
          },
        ]);
      } catch {}
    }

    // 5) баланс после
    const starsAfter = await getStars(supabase, tg_id).catch(() => starsBefore + delta);
    return res.status(200).json({ ok: true, prize, balance: starsAfter, tg_id });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "SPIN_FAILED", details: e?.message || String(e), balance: starsBefore, tg_id });
  }
}

async function getStars(supabase: any, tg_id: number): Promise<number> {
  const { data, error } = await supabase.from("balances_by_tg").select("stars").eq("tg_id", tg_id).maybeSingle();
  if (error) throw error;
  return Number(data?.stars || 0);
}
