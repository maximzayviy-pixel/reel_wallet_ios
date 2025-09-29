import type { NextApiRequest, NextApiResponse } from "next";
import { ensureIsAdminApi } from "../../../lib/admin";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

/**
 * POST `/api/admin/ban`
 *
 * Toggles the `is_banned` flag for a user identified by `tg_id`.  This
 * endpoint requires admin authentication, verified via `ensureIsAdminApi`.
 * The request body should include:
 *   - `tg_id` (number): Telegram ID of the user to ban/unban
 *   - `ban`   (boolean, optional): whether to ban (true) or unban (false); defaults to true
 *   - `reason` (string, optional): reason for the ban
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureIsAdminApi(req);
    const { tg_id, ban = true, reason = null } = req.body || {};
    if (!tg_id) return res.status(400).json({ ok: false, error: "tg_id required" });
    const { error } = await supabaseAdmin
      .from("users")
      .update({ is_banned: !!ban, ban_reason: reason })
      .eq("tg_id", tg_id);
    if (error) return res.status(400).json({ ok: false, error: error.message });
    res.status(200).json({ ok: true });
  } catch (e: any) {
    // If ensureIsAdminApi throws a Response, forward its status and body
    if (e instanceof Response) {
      const text = await e.text();
      return res.status((e as any).status || 500).send(text);
    }
    res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
}