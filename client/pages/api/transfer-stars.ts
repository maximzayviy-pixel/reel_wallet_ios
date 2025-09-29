// client/pages/api/transfer-stars.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: true } };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabaseForAuth = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});
const supabaseForDB = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // --- 1. Проверка токена ---
  const authHeader = req.headers.authorization || "";
  const tokenMatch = authHeader.match(/^Bearer (.+)$/);
  if (!tokenMatch) return res.status(401).json({ error: "Authorization required" });
  const accessToken = tokenMatch[1];

  const { data: userData, error: userErr } = await supabaseForAuth.auth.getUser(accessToken);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  const user = userData.user;
  const fromTgId = user.user_metadata?.telegram_id;
  if (!fromTgId) {
    return res.status(400).json({ error: "No telegram id linked to account" });
  }

  // --- 2. Валидация входных данных ---
  const { to_tg_id, amount_stars, note } = req.body || {};
  const numericAmount = Math.floor(Number(amount_stars || 0));
  if (!to_tg_id || !numericAmount || numericAmount <= 0) {
    return res.status(400).json({ error: "Invalid input" });
  }
  if (Number(to_tg_id) === Number(fromTgId)) {
    return res.status(400).json({ error: "SELF_TRANSFER_FORBIDDEN" });
  }

  // --- 3. Вызов защищённой RPC ---
  try {
    const { data, error } = await supabaseForDB.rpc("transfer_stars", {
      p_from_tg_id: fromTgId,
      p_to_tg_id: Number(to_tg_id),
      p_amount: numericAmount,
      p_actor_user_id: user.id,
      p_note: note?.slice(0, 120) || null,
    });

    if (error) {
      console.error("transfer_stars error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, result: data });
  } catch (err) {
    console.error("unexpected:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
