// client/pages/api/admin/withdraw-approve.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { ensureIsAdmin } from "../../lib/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const admin = await ensureIsAdmin(req as any);
  if (!admin) return;

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ ok:false, error:"id required" });

  const { data, error } = await supabaseAdmin
    .from("withdraw_requests")
    .update({ status:"paid", admin_id: admin.id, paid_at: new Date() })
    .eq("id", id)
    .select("tg_id, amount_stars")
    .single();
  if (error) return res.status(400).json({ ok:false, error:error.message });

  // списание ⭐
  const { error: rpcErr } = await supabaseAdmin.rpc("debit_user_balance", {
    p_tg_id: data.tg_id,
    p_amount: data.amount_stars,
    p_reason: "withdraw_sbp"
  });
  if (rpcErr) return res.status(400).json({ ok:false, error: rpcErr.message });

  res.status(200).json({ ok:true });
}
