// client/pages/api/transfer-stars.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const config = { api: { bodyParser: true } };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""; // must be set in prod

const supabaseForAuth = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const supabaseForDB = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type AuthedUser = { id: string; telegram_id?: number };

function verifyTelegramInitData(initData: string): { ok: boolean; tg_id?: number; reason?: string } {
  try {
    if (!TELEGRAM_BOT_TOKEN) return { ok: false, reason: "SERVER_MISCONFIG_TG_TOKEN" };
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash") || "";
    urlParams.delete("hash");

    const keys = Array.from(urlParams.keys()).sort();
    const pairs: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = urlParams.get(key);
      if (value !== null) pairs.push(key + "=" + value);
    }
    const dataCheckString = pairs.join("\n");

    const secretKey = crypto.createHash("sha256").update(TELEGRAM_BOT_TOKEN).digest();
    const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (hmac !== hash) return { ok: false, reason: "BAD_TG_SIGNATURE" };

    const userJson = urlParams.get("user");
    if (!userJson) return { ok: false, reason: "NO_TG_USER" };
    const user = JSON.parse(userJson);
    const tg_id = Number(user && user.id);
    if (!tg_id) return { ok: false, reason: "NO_TG_ID" };
    return { ok: true, tg_id };
  } catch (e) {
    return { ok: false, reason: "VERIFY_EXCEPTION" };
  }
}

async function getAuthedUser(req: NextApiRequest): Promise<{ user: AuthedUser | null; reason?: string }> {
  // 1) Supabase Bearer token
  const authHeader = req.headers.authorization || "";
  const m = authHeader.match(/^Bearer (.+)$/);
  if (m) {
    const { data, error } = await supabaseForAuth.auth.getUser(m[1]);
    if (!error && data && data.user) {
      return { user: { id: data.user.id, telegram_id: data.user.user_metadata && data.user.user_metadata.telegram_id } };
    }
  }
  // 2) Telegram initData — from header OR body
  let initData: string | null = null;
  const h = req.headers["x-telegram-init-data"];
  if (typeof h === "string" && h.length > 0) initData = h;
  if (!initData && req.body && typeof req.body.init_data === "string") initData = req.body.init_data;

  if (!initData) return { user: null, reason: "NO_TOKEN_HEADERS" };
  const v = verifyTelegramInitData(initData);
  if (!v.ok || !v.tg_id) return { user: null, reason: v.reason || "BAD_TG_SIGNATURE" };

  // Map tg_id -> user record
  const { data, error } = await supabaseForDB
    .from("users")
    .select("id")
    .eq("tg_id", v.tg_id)
    .single();
  if (error || !data) return { user: null, reason: "USER_NOT_FOUND" };

  return { user: { id: data.id, telegram_id: v.tg_id } };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user: authed, reason } = await getAuthedUser(req);
  if (!authed) {
    console.warn("transfer-stars 401", { reason });
    const status = reason === "SERVER_MISCONFIG_TG_TOKEN" ? 500 : 401;
    return res.status(status).json({ error: "Authorization required", reason });
  }
  if (!authed.telegram_id) {
    console.warn("transfer-stars 400 No telegram id linked", { userId: authed.id });
    return res.status(400).json({ error: "No telegram id linked to account" });
  }

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

  if (error) {
    console.error("transfer-stars RPC error", { code: error.code, message: error.message });
    return res.status(400).json({ error: error.message });
  }
  return res.status(200).json({ ok: true, result: data });
}
