// pages/api/roulette-spin.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const COST_PER_SPIN = 15;

type Prize =
  | { type: "stars"; label: string; value: number; weight: number }
  | { type: "nft"; label: string; image: string; weight: number };

// Requested prize set
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
  for (const p of PRIZES) {
    acc += p.weight;
    if (r <= acc) return p;
  }
  return PRIZES[0];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  // Get Telegram user id from initData (preferred) or body as fallback
  const initData = (req.headers["x-init-data"] as string) || "";
  const bodyTg = Number((req.body || {})?.tg_id || 0);
  // Minimal extraction of tg_id without full signature verification (assumed trusted reverse-proxy)
  let tg_id = bodyTg;
  try {
    const m = /user=%7B%22id%22%3A(\d+)/.exec(encodeURIComponent(initData));
    if (m) tg_id = Number(m[1]);
  } catch {}
  if (!tg_id) return res.status(401).json({ error: "Unauthorized" });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });

  try {
    // 1) Check balance
    const { data: balView, error: balErr } = await supabase.rpc("get_balance_by_tg", { in_tg_id: tg_id });
    if (balErr) throw balErr;
    const balance: number = balView?.balance ?? 0;
    if (balance < COST_PER_SPIN) return res.status(400).json({ error: "NOT_ENOUGH_STARS" });

    // 2) Charge spin cost
    const { error: debitErr } = await supabase.from("ledger").insert({
      tg_id,
      delta: -COST_PER_SPIN,
      type: "roulette_cost",
      meta: { game: "roulette" },
    });
    if (debitErr) throw debitErr;

    // 3) Pick prize
    const prize = pickPrize();

    // 4) Apply prize
    if (prize.type === "stars") {
      const { error: deltaErr } = await supabase.from("ledger").insert({
        tg_id,
        delta: prize.value,
        type: "roulette_prize",
        meta: { label: prize.label },
      });
      if (deltaErr) throw deltaErr;
    } else {
      // NFT — record as meta event without changing balance
      const { error: nftErr } = await supabase.from("ledger").insert({
        tg_id,
        delta: 0,
        type: "nft_reward",
        meta: { label: prize.label, image: prize.image, game: "roulette" },
      });
      if (nftErr) throw nftErr;
    }

    // 5) New balance
    const { data: balAfter, error: balAfterErr } = await supabase.rpc("get_balance_by_tg", { in_tg_id: tg_id });
    if (balAfterErr) throw balAfterErr;

    res.status(200).json({ prize, balance: balAfter?.balance ?? 0 });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: "SPIN_FAILED" });
  }
}
