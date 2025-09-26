
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type GuardUser = { id?: string; tg_id?: string; role?: string };

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || "";
}

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

  // build data_check_string (exclude hash)
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

export async function requireAdmin(req: NextApiRequest, res: NextApiResponse): Promise<GuardUser | null> {
  try {
    // 1) если есть cookie-сессия — пускаем
    const cookie = req.headers.cookie || "";
    if (cookie.includes("tg_admin=1")) {
      return { role: "admin" };
    }

    // 2) пробуем header с initData (из WebApp)
    const initData = (req.headers["x-telegram-init-data"] as string) || "";
    if (initData && checkTelegramSignature(initData)) {
      // user JSON хранится в поле 'user' (строка JSON)
      const params = new URLSearchParams(initData);
      const userRaw = params.get("user");
      let tg_id: string | undefined = undefined;
      if (userRaw) {
        try {
          const u = JSON.parse(userRaw);
          tg_id = String(u?.id || "");
        } catch {}
      }

      // роль из env-оверрайда
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

    // 3) запасной вариант: список суперадминов из ENV (если явно пришёл x-telegram-user-id)
    const superAdmins = (process.env.NEXT_PUBLIC_ADMINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tgIdHeader = (req.headers["x-telegram-user-id"] as string) || "";
    if (tgIdHeader && superAdmins.includes(tgIdHeader)) {
      return { role: "admin", tg_id: tgIdHeader };
    }

    return res.status(401).json({ error: "FORBIDDEN: bad telegram signature" }) as any;
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "GUARD_ERROR" }) as any;
  }
}
