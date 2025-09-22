// pages/api/auth-upsert.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const { tg_id, username, first_name, last_name } = req.body;

  if (!tg_id) return res.status(400).json({ ok: false, error: "tg_id required" });

  // upsert именно по tg_id
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        tg_id,
        username,
        first_name,
        last_name,
        role: "user",
      },
      { onConflict: "tg_id" }   // <-- важно
    )
    .select()
    .single();

  if (error) {
    console.error("auth-upsert error", error);
    return res.status(500).json({ ok: false, error: error.message });
  }

  return res.json({ ok: true, user: data });
}
