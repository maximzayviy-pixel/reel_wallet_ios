// pages/api/redeem-invite.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Body = { tg_id?: number; code?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(200).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const { tg_id, code } = (req.body || {}) as Body;
  const normCode = (code || "").trim().toUpperCase();
  if (!tg_id || !normCode) return res.status(200).json({ ok: false, error: "BAD_INPUT" });

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(200).json({ ok: false, error: "NO_SERVICE_KEY" });

  const admin = createClient(SUPABASE_URL!, SERVICE_KEY!);

  try {
    // find user by tg_id
    const { data: users, error: userErr } = await admin.from("users").select("id").eq("tg_id", tg_id).limit(1);
    if (userErr) throw userErr;
    const user = users?.[0];
    if (!user) return res.status(200).json({ ok: false, error: "USER_NOT_FOUND" });

    const { error } = await admin.rpc("redeem_invite_code", { p_referred: user.id, p_code: normCode });
    if (error) {
      const code = String(error.message || "").toUpperCase();
      return res.status(200).json({ ok: false, error: code });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("redeem-invite error:", e?.message || e);
    return res.status(200).json({ ok: false, error: "SERVER_ERROR" });
  }
}
