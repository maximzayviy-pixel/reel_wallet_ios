import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { ensureIsAdminApi } from "../../../lib/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    await ensureIsAdminApi(req);

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: "id required" });

    const { error } = await supabaseAdmin
      .from("withdraw_requests")
      .update({ status: "rejected" })
      .eq("id", id);

    if (error) return res.status(400).json({ ok: false, error: error.message });
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ ok: false, error: e.message || "Server error" });
  }
}
