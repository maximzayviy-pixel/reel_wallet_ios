// pages/api/my-balance.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
);

type Data =
  | { ok: true; tg_id: number; balance: number }
  | { ok: false; code: string; message: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  try {
    const tg_id_raw = (req.query.tg_id ?? req.body?.tg_id) as string | undefined;
    const tg_id = Number(tg_id_raw);
    if (!tg_id || Number.isNaN(tg_id)) {
      return res.status(400).json({ ok: false, code: "BAD_TG_ID", message: "tg_id is required" });
    }

    // Универсальный подсчёт: поддерживает ledger.delta ИЛИ ledger.amount
    const { data, error } = await supabase
      .from("ledger")
      .select("delta, amount")
      .eq("tg_id", tg_id);

    if (error) throw error;

    const balance = (data ?? []).reduce((acc, row: any) => {
      const d = typeof row.delta === "number" ? row.delta : 0;
      const a = typeof row.amount === "number" ? row.amount : 0;
      return acc + (d || a || 0);
    }, 0);

    return res.status(200).json({ ok: true, tg_id, balance });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, code: "BALANCE_FAILED", message: e?.message ?? "Unknown error" });
  }
}
