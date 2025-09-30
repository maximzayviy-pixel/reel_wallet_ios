// pages/api/roulette-spin.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const COST = 15;

// Шансы/призы (тот же набор, что в UI)
const PRIZES = [
  { label: "+3 ⭐", delta: 3,  weight: 30 },
  { label: "+5 ⭐", delta: 5,  weight: 24 },
  { label: "+10 ⭐", delta: 10, weight: 18 },
  { label: "+15 ⭐", delta: 15, weight: 12 },
  { label: "+50 ⭐", delta: 50, weight: 8 },
  { label: "+100 ⭐", delta: 100, weight: 5.5 },
  { label: "+1000 ⭐", delta: 1000, weight: 2.4 },
  { label: "Plush Pepe NFT", delta: 0, weight: 0.1, kind: "NFT" as const },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
);

type Ok =
  | {
      ok: true;
      code: "SPIN_OK";
      result: {
        prizeLabel: string;
        prizeDelta: number;
        kind?: "NFT";
        newBalance: number;
      };
    };

type Err = { ok: false; code: string; message: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "POST only" });
  }

  try {
    const tg_id = Number(req.body?.tg_id ?? req.query?.tg_id);
    if (!tg_id || Number.isNaN(tg_id)) {
      return res.status(400).json({ ok: false, code: "BAD_TG_ID", message: "tg_id is required" });
    }

    // 1) читаем баланс (универсально: delta или amount)
    const { data: rows, error: readErr } = await supabase
      .from("ledger")
      .select("delta, amount")
      .eq("tg_id", tg_id);

    if (readErr) throw readErr;

    const balance = (rows ?? []).reduce((acc, r: any) => {
      const d = typeof r.delta === "number" ? r.delta : 0;
      const a = typeof r.amount === "number" ? r.amount : 0;
      return acc + (d || a || 0);
    }, 0);

    if (balance < COST) {
      return res.status(400).json({
        ok: false,
        code: "NOT_ENOUGH_STARS",
        message: `Need ${COST}⭐, have ${balance}⭐`,
      });
    }

    // 2) выбираем приз по весам
    const prize = pickWeighted(PRIZES);

    // 3) транзакция: списание COST и начисление приза
    // supabase-js не даёт явных транзакций; используем RPC или один upsert нельзя.
    // Решение: безопасная серверная логика — две вставки с метками и идемпотентным spin_id
    const spinId = cryptoRandomId();

    // Вставка двух строк в ledger: -COST и +PRIZE
    // Поддерживаем и delta, и amount: пишем обе колонки, какая есть — та и засчитается.
    const insertPayload = [
      {
        tg_id,
        delta: -COST,
        amount: -COST,
        reason: "roulette_cost",
        meta: { spin_id: spinId },
      },
      {
        tg_id,
        delta: prize.delta,
        amount: prize.delta,
        reason: prize.kind === "NFT" ? "roulette_prize_nft" : "roulette_prize_stars",
        meta: { spin_id: spinId, label: prize.label },
      },
    ];

    const { error: insErr } = await supabase.from("ledger").insert(insertPayload);
    if (insErr) throw insErr;

    // 4) новый баланс
    const newBalance = balance - COST + prize.delta;

    // 5) если приз — NFT, создаём запись в gifts (по желанию)
    if (prize.kind === "NFT") {
      await supabase.from("gifts").insert({
        tg_id,
        title: "Plush Pepe NFT",
        image_url: "https://i.imgur.com/BmoA5Ui.jpeg",
        meta: { spin_id: spinId },
      });
    }

    return res.status(200).json({
      ok: true,
      code: "SPIN_OK",
      result: {
        prizeLabel: prize.label,
        prizeDelta: prize.delta,
        kind: prize.kind,
        newBalance,
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      code: "SPIN_FAILED",
      message: e?.message ?? "Unknown error",
    });
  }
}

function pickWeighted<T extends { weight: number }>(arr: T): T {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const item of arr) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return arr[arr.length - 1];
}

function cryptoRandomId() {
  // Идемпотентность вставок по spin_id (для будущих UPSERT’ов)
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
