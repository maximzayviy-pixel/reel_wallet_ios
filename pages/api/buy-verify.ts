// pages/api/buy-verify.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  try {
    const { tg_id, price_rub = 199 } = req.body || {};
    if (!tg_id) return res.status(400).json({ ok: false, error: "missing_tg_id" });

    // try verify_requests first
    let id: any = null;
    const tryTables = ["verify_requests", "payment_requests"];
    for (const table of tryTables) {
      const { data, error } = await supabase
        .from(table)
        .insert({ tg_id: String(tg_id), amount_rub: price_rub, status: "pending", type: "verify" })
        .select("id")
        .single();
      if (!error && data) {
        id = data.id;
        break;
      }
    }
    if (!id) throw new Error("insert_failed");

    // Return internal completion link (can be replaced with real payment provider callback)
    return res.json({ ok: true, id, link: `/verify/success?req=${id}` });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "unknown_error" });
  }
}
