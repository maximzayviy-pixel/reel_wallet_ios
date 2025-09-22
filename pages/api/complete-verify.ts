// pages/api/complete-verify.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

    // try update in both tables
    const tables = ["verify_requests", "payment_requests"];
    let updated = false;
    for (const table of tables) {
      const { error } = await supabase.from(table)
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", id);
      if (!error) updated = true;
    }

    return res.json({ ok: updated });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "unknown_error" });
  }
}
