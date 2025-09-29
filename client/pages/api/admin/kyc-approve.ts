// client/pages/api/admin/kyc-approve.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { ensureIsAdmin } from "../../lib/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  await ensureIsAdmin(req as any);
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ ok:false, error:"id required" });

  const { data, error } = await supabaseAdmin
    .from("kyc_requests")
    .update({ status:"approved", reviewed_at: new Date() })
    .eq("id", id)
    .select("tg_id")
    .single();

  if (error) return res.status(400).json({ ok:false, error:error.message });

  await supabaseAdmin.from("users").update({ is_verified:true }).eq("tg_id", data.tg_id);
  return res.status(200).json({ ok:true });
}
