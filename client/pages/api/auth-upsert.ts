// pages/api/auth-upsert.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("auth-upsert: missing Supabase env");
    return res.status(500).json({ ok: false, error: "no_supabase_env" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { tg_id, username, first_name, last_name } = req.body || {};
  console.log("auth-upsert req.body", req.body);

  if (!tg_id) {
    return res.status(400).json({ ok: false, error: "tg_id required" });
  }

  try {
    // Используем RPC функцию для создания/обновления пользователя
    const { data, error } = await supabase.rpc('create_or_update_user', {
      p_tg_id: Number(tg_id),
      p_username: username || null,
      p_first_name: first_name || null,
      p_last_name: last_name || null
    });

    console.log("auth-upsert result", { data, error });

    if (error) {
      console.error("auth-upsert error", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, user: data?.[0] || null });
  } catch (e: any) {
    console.error("auth-upsert exception", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
