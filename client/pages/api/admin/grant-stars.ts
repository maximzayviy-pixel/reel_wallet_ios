import type { NextApiRequest, NextApiResponse } from "next";
import { ensureIsAdmin } from "../../../lib/admin";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureIsAdmin(req as any);
    const { tg_id, stars } = req.body || {};
    if (!tg_id || !stars) return res.status(400).json({ ok:false, error:"tg_id and stars required" });
    // Using a stored procedure keeps business logic consistent with RLS/ledger:
    const { error } = await supabaseAdmin.rpc("admin_grant_stars", { p_tg_id: tg_id, p_stars: stars });
    if (error) return res.status(400).json({ ok:false, error: error.message });
    res.status(200).json({ ok:true });
  } catch (e:any) {
    if (e instanceof Response) {
      const text = await e.text();
      return res.status(e.status || 500).send(text);
    }
    res.status(500).json({ ok:false, error: e?.message || "SERVER_ERROR" });
  }
}
