// client/pages/api/transfer-stars.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const config = { api: { bodyParser: true } };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""; // for Telegram initData verification

const supabaseForAuth = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const supabaseForDB = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type AuthedUser = { id: string; telegram_id?: number };

// Telegram WebApp initData verification without spread/iterators that need downlevelIteration
function verifyTelegramInitData(initData: string): { ok: boolean; tg_id?: number } {
  try {
    if (!TELEGRAM_BOT_TOKEN) return { ok: false };
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash") || "";
    urlParams.delete("hash");

    // Build data_check_string as per Telegram docs: sorted "key=value" joined by "\n"
    const keys = Array.from(urlParams.keys()).sort();
    const pairs: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = urlParams.get(key);
      if (value !== null) pairs.push(key + "=" + value);
    }
    const dataCheckString = pairs.join("\n");

    // secret key: SHA256(bot_token)
    const secretKey = crypto.createHash("sha256").update(TELEGRAM_BOT_TOKEN).digest();
    const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (hmac !== hash) return { ok: false };

    // Extract user JSON
    const userJson = urlParams.get("user");
    if (!userJson) return { ok: false };
    const user = JSON.parse(userJson);
    const tg_id = Number(user && user.id);
    if (!tg_id) return { ok: false };
    return { ok: true, tg_id };
  } catch {
    return { ok: false };
  }
}

async function getAuthedUser(req: NextApiRequest): Promise<AuthedUser | null> {
  // 1) Try Supabase Bearer token
  const authHeader = req.headers.authorization || "";
  const m = authHeader.match(/^Bearer (.+)$/);
  if (m) {
    const { data, error } = await supabaseForAuth.auth.getUser(m[1]);
    if (!error && data && data.user) {
      return { id: data.user.id, telegram_id: data.user.user_metadata && data.user.user_metadata.telegram_id };
    }
  }
  // 2) Try Telegram initData header
  const initDataHeader = req.headers["x-telegram-init-data"];
  if (typeof initDataHeader === "string" && initDataHeader.length > 0) {
    const v = verifyTelegramInitData(initDataHeader);
    if (v.ok && v.tg_id) {
      // Map tg_id -> user in DB
      const { data, error } = await supabaseForDB
        .from("users")
        .select("id")
        .eq("tg_id", v.tg_id)
        .single();
      if (!error && data && data.id) {
        return { id: data.id, telegram_id: v.tg_id };
      }
    }
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: "Authorization required" });
  if (!authed.telegram_id) return res.status(400).json({ error: "No telegram id linked to account" });

  const { to_tg_id, amount_stars, note } = req.body || {};
  const amount = Math.floor(Number(amount_stars || 0));
  if (!to_tg_id || !amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid input" });
  }
  if (Number(to_tg_id) === Number(authed.telegram_id)) {
    return res.status(400).json({ error: "SELF_TRANSFER_FORBIDDEN" });
  }

  const { data, error } = await supabaseForDB.rpc("transfer_stars", {
    p_from_tg_id: Number(authed.telegram_id),
    p_to_tg_id: Number(to_tg_id),
    p_amount: amount,
    p_actor_user_id: authed.id,
    p_note: note ? String(note).slice(0, 120) : null,
  });

  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ ok: true, result: data });
}
