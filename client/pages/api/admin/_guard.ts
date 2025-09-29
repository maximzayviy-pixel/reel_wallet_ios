// pages/api/admin/_guard.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type GuardUser = { id?: string; tg_id?: string; role?: string };

// --- helpers env ---
function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || "";
}
function getAdminHttpKey() {
  return process.env.ADMIN_HTTP_KEY || "";
}
function getCronSecret() {
  return process.env.CRON_SECRET || "";
}

// --- parse/initData + signature check ---
function parseInitData(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const params = new URLSearchParams(raw);
    const data: Record<string, string> = {};
    params.forEach((v, k) => (data[k] = v));
    return data;
  } catch {
    return null;
  }
}
function checkTelegramSignature(initData: string): boolean {
  const data = parseInitData(initData);
  if (!data) return false;
  const receivedHash = data["hash"];
  if (!receivedHash) return false;

  const pairs: string[] = [];
  Object.keys(data)
    .filter((k) => k !== "hash")
    .sort()
    .forEach((k) => pairs.push(`${k}=${data[k]}`));
  const dataCheckString = pairs.join("\n");

  const botToken = getBotToken();
  if (!botToken) return false;

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return hmac === receivedHash;
}

// --- new: key-based access (for outside the mini-app) ---
function matchesAdminKey(req: NextApiRequest): boolean {
  const ADMIN_HTTP_KEY = getAdminHttpKey();
  const CRON_SECRET = getCronSecret();

  const headerKey =
    (req.headers["x-admin-key"] as string) ||
    (req.headers["x-cron-key"] as string) ||
    (req.query?.key as string) ||
    "";

  if (!headerKey) return false;
  if (ADMIN_HTTP_KEY && headerKey === ADMIN_HTTP_KEY) return true;
  if (CRON_SECRET && headerKey === CRON_SECRET) return true;
  return false;
}

export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<GuardUser | null> {
  try {
    // 0) быстрый пропуск по cookie
    const cookie = req.headers.cookie || "";
    if (cookie.includes("tg_admin=1")) {
      return { role: "admin" };
    }

    // 1) new: секретный ключ (вне Telegram, curl/браузер/cron)
    if (matchesAdminKey(req)) {
      return { role: "admin" };
    }

    // 2) Telegram WebApp initData из заголовка
    const initData =
      (req.headers["x-telegram-init-data"] as string) ||
      (req.headers["x-init-data"] as string) || // на всякий случай поддержим альтернативное имя
      "";

    if (initData && checkTelegramSignature(initData)) {
      // user JSON лежит в поле 'user'
      const params = new URLSearchParams(initData);
      const userRaw = params.get("user");
      let tg_id: string | undefined = undefined;
      if (userRaw) {
        try {
          const u = JSON.parse(userRaw);
          tg_id = String(u?.id || "");
        } catch {}
      }

      // супер-админы из ENV
      const envAdmins = (process.env.NEXT_PUBLIC_ADMINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (tg_id && envAdmins.includes(tg_id)) {
        return { role: "admin", tg_id };
      }

      // роль из БД
      if (tg_id) {
        const { data, error } = await supabaseAdmin
          .from("users")
          .select("role")
          .eq("tg_id", tg_id)
          .maybeSingle();
        if (!error && data && (data.role ?? "user") === "admin") {
          return { role: "admin", tg_id };
        }
      }

      return res.status(403).json({ error: "FORBIDDEN: not admin" }) as any;
    }

    // 3) запасной путь: список суперадминов из ENV + прямой заголовок tg id
    const superAdmins = (process.env.NEXT_PUBLIC_ADMINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tgIdHeader = (req.headers["x-telegram-user-id"] as string) || "";
    if (tgIdHeader && superAdmins.includes(tgIdHeader)) {
      return { role: "admin", tg_id: tgIdHeader };
    }

    // 4) ничего не подошло
    return res.status(401).json({ error: "FORBIDDEN: bad telegram signature or no admin key" }) as any;
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "GUARD_ERROR" }) as any;
  }
}
