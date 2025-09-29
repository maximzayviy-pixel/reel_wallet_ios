import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { ensureIsAdminApi } from "../../../lib/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const admin = await ensureIsAdminApi(req);

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: "id required" });

    const { data, error } = await supabaseAdmin
      .from("kyc_requests")
      .update({ status: "approved", reviewed_at: new Date() })
      .eq("id", id)
      .select("tg_id")
      .single();

    if (error) return res.status(400).json({ ok: false, error: error.message });

    await supabaseAdmin.from("users").update({ is_verified: true }).eq("tg_id", data.tg_id);

    res.status(200).json({ ok: true, admin });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ ok: false, error: e.message || "Server error" });
  }
}
