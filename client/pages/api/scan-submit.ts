// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

// ---- helpers ----
function pickSbpUrlFromPayload(payload: string): string | null {
  if (!payload) return null;
  const m1 = payload.match(/https?:\/\/qr\.nspk\.ru\/[A-Za-z0-9]+(?:\?[^\s<">]*)?/i);
  if (m1) return m1[0];
  const m2 = payload.match(/(https?:\/\/qr\.nspk\.ru\/[A-Za-z0-9]+(?:\?[^\s<">]*)?)/i);
  if (m2) return m2[1];
  return null;
}
const htmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// server-side Uploadcare: dataURL -> CDN URL
async function uploadcareFromDataUrl(dataUrl: string): Promise<string | null> {
  try {
    if (!/^data:/i.test(dataUrl)) return null;
    const pub =
      process.env.UPLOADCARE_PUBLIC_KEY ||
      process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY;
    if (!pub) throw new Error("UPLOADCARE_PUBLIC_KEY is missing");

    const idx = dataUrl.indexOf(",");
    const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;

    const form = new FormData();
    form.append("UPLOADCARE_PUB_KEY", pub);
    form.append("UPLOADCARE_STORE", "1");
    form.append("file", base64);

    const res = await fetch("https://upload.uploadcare.com/base64/", {
      method: "POST",
      body: form as any,
    });
    const json: any = await res.json();
    if (!res.ok || !json?.file) throw new Error(json?.error || "Uploadcare error");
    return `https://ucarecdn.com/${json.file}/`;
  } catch (e) {
    console.error("uploadcareFromDataUrl failed:", e);
    return null;
  }
}

// нормализуем фото: http(s) как есть, data: -> заливаем в Uploadcare
async function normalizePhotoUrl(qr_image_b64?: string): Promise<string | null> {
  if (!qr_image_b64) return null;
  if (/^https?:\/\//i.test(qr_image_b64)) return qr_image_b64;
  if (/^data:/i.test(qr_image_b64)) return await uploadcareFromDataUrl(qr_image_b64);
  return null;
}

// Telegram: безопасно отправить фото (или fallback текстом со ссылкой)
async function notifyAdmin({
  botToken,
  chatId,
  caption,
  photoUrl,
  payloadLongText,
  requestId,
}: {
  botToken: string;
  chatId: string;
  caption: string;
  photoUrl: string | null;
  payloadLongText?: string; // длинный сырой payload, если надо дослать вторым сообщением
  requestId: string; // ID запроса для кнопок
}): Promise<{ ok: boolean; debug: any }> {
  const base = `https://api.telegram.org/bot${botToken}`;

  // ограничим подпись для sendPhoto — максимум ~1024
  const CAPTION_MAX = 950;
  const capShort = caption.length > CAPTION_MAX ? caption.slice(0, CAPTION_MAX) + "…" : caption;

  // 1) пытаемся sendPhoto, если есть URL
  if (photoUrl) {
    try {
      console.log('Sending photo with buttons:', { requestId, photoUrl: photoUrl.substring(0, 50) + '...' });
      
      const resp = await fetch(`${base}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: capShort,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Оплачено", callback_data: `pay:${requestId}` },
                { text: "❌ Отказать", callback_data: `rej:${requestId}` },
              ],
            ],
          },
        }),
      });
      const j = await resp.json().catch(() => ({}));
      console.log('Photo send result:', { ok: j?.ok, error: j?.error_code, description: j?.description });
      
      if (j?.ok) {
        // если caption был урезан — длинный payload добросим вторым сообщением как реплай
        if (payloadLongText && caption.length > CAPTION_MAX) {
          try {
            await fetch(`${base}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: payloadLongText,
                parse_mode: "HTML",
                reply_to_message_id: j.result?.message_id,
              }),
            });
          } catch {}
        }
        return { ok: true, debug: { ok: j.ok } };
      }
      // если не ок — упадём в фолбэк
      return {
        ok: false,
        debug: { stage: "sendPhoto", error_code: j?.error_code, description: j?.description },
      };
    } catch (e: any) {
      console.error('Photo send error:', e);
      return { ok: false, debug: { stage: "sendPhoto", exception: String(e) } };
    }
  }

  // 2) фолбэк: sendMessage с ссылкой на фото/qr
  try {
    console.log('Sending text message with buttons:', { requestId, captionLength: caption.length });
    
    const resp = await fetch(`${base}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Оплачено", callback_data: `pay:${requestId}` },
              { text: "❌ Отказать", callback_data: `rej:${requestId}` },
            ],
          ],
        },
      }),
    });
    const j = await resp.json().catch(() => ({}));
    console.log('Text message send result:', { ok: j?.ok, error: j?.error_code, description: j?.description });
    
    return { ok: !!j?.ok, debug: { stage: "sendMessage", ok: j?.ok, error_code: j?.error_code, description: j?.description } };
  } catch (e: any) {
    console.error('Text message send error:', e);
    return { ok: false, debug: { stage: "sendMessage", exception: String(e) } };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("no_supabase_env");
    return res.status(500).json({ ok: false, error: "SERVER_CONFIG_ERROR" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { tg_id, qr_payload, amount_rub, qr_image_b64, force_notify } = req.body as {
    tg_id?: number | string;
    qr_payload?: string;
    amount_rub?: number;
    qr_image_b64?: string;
    force_notify?: boolean;
  };

  // Валидация входных данных
  if (!tg_id || !qr_payload || !amount_rub) {
    return res
      .status(400)
      .json({ ok: false, error: "MISSING_REQUIRED_FIELDS", reason: "tg_id, qr_payload, amount_rub are required" });
  }

  // Валидация tg_id
  const tgIdNum = Number(tg_id);
  if (isNaN(tgIdNum) || tgIdNum <= 0) {
    return res
      .status(400)
      .json({ ok: false, error: "INVALID_TG_ID", reason: "tg_id must be a positive number" });
  }

  // Валидация amount_rub
  if (amount_rub <= 0 || amount_rub > 100000) {
    return res
      .status(400)
      .json({ ok: false, error: "INVALID_AMOUNT", reason: "amount_rub must be between 1 and 100000" });
  }

  // Валидация qr_payload
  if (typeof qr_payload !== "string" || qr_payload.length > 10000) {
    return res
      .status(400)
      .json({ ok: false, error: "INVALID_QR_PAYLOAD", reason: "qr_payload must be a string with max 10000 characters" });
  }

  // 1) user
  let userRow;
  try {
    const { data, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("tg_id", tgIdNum)
      .maybeSingle();
    
    if (userErr) {
      console.error("user lookup error", userErr);
      return res.status(500).json({ ok: false, error: "DATABASE_ERROR", reason: userErr.message });
    }
    
    if (!data) {
      console.error("NO_USER", { tgId: tgIdNum });
      return res.status(402).json({ ok: false, reason: "NO_USER" });
    }
    
    userRow = data;
  } catch (e: any) {
    console.error("User lookup failed:", e);
    return res.status(500).json({ ok: false, error: "DATABASE_ERROR", reason: e?.message || "Unknown error" });
  }

  // 2) balance
  let warnInsufficient = false;
  let currentStars = 0;
  try {
    const { data: balRow, error: balErr } = await supabase
      .from("balances_by_tg")
      .select("stars")
      .eq("tg_id", tgIdNum)
      .maybeSingle();
    
    if (balErr) {
      console.error("balance lookup error", balErr);
      return res.status(500).json({ ok: false, error: "DATABASE_ERROR", reason: "Failed to check balance" });
    }
    
    if (!balRow) {
      return res.status(402).json({ ok: false, reason: "NO_USER" });
    }

    currentStars = Number(balRow.stars) || 0;
    const needStars = Math.round(amount_rub * 2);
    
    if (currentStars < needStars) {
      if (!force_notify) {
        return res
          .status(402)
          .json({ ok: false, reason: "INSUFFICIENT_BALANCE", need: needStars, have: currentStars });
      }
      warnInsufficient = true;
    }
  } catch (e: any) {
    console.error("Balance check failed", e);
    return res.status(500).json({ ok: false, error: "DATABASE_ERROR", reason: "Failed to check balance" });
  }

  // 3) insert request
  let requestId;
  try {
    const { data: ins, error: insErr } = await supabase
      .from("payment_requests")
      .insert([{ 
        tg_id: tgIdNum, 
        user_id: userRow.id, 
        qr_payload, 
        amount_rub, 
        status: "pending",
        qr_image_url: qr_image_b64 
      }])
      .select()
      .single();
    
    if (insErr) {
      console.error("insert_failed", insErr);
      return res.status(500).json({ ok: false, error: "DATABASE_ERROR", reason: insErr.message });
    }
    
    if (!ins?.id) {
      return res.status(500).json({ ok: false, error: "DATABASE_ERROR", reason: "Failed to create payment request" });
    }
    
    requestId = ins.id;
  } catch (e: any) {
    console.error("Insert request failed:", e);
    return res.status(500).json({ ok: false, error: "DATABASE_ERROR", reason: e?.message || "Unknown error" });
  }

  // 4) notify admin
  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
  const ADMIN_TG_ID = process.env.ADMIN_TG_ID || process.env.TELEGRAM_ADMIN_CHAT || "";
  let adminNotified = false;
  let telegram_debug: any = null;

  if (TG_BOT_TOKEN && ADMIN_TG_ID) {
    try {
      const sbpUrl = pickSbpUrlFromPayload(qr_payload);
      const urlLine = sbpUrl
        ? `\n<a href="${sbpUrl}">Оплатить в банке</a>`
        : "\nQR не содержит функциональной ссылки СБП";

      const escapedPayload = qr_payload ? htmlEscape(qr_payload) : "";
      const needStars = Math.round(amount_rub * 2);

      const caption =
        `<b>#${requestId}</b>\n` +
        `Запрос оплаты от <code>${tgIdNum}</code>\n` +
        `Сумма: <b>${amount_rub} ₽</b> (${needStars} ⭐)\n` +
        `Баланс пользователя: <b>${currentStars} ⭐</b>` +
        (warnInsufficient ? `\n⚠️ Недостаточно ⭐ у пользователя (${currentStars}/${needStars})` : "") +
        urlLine +
        (escapedPayload ? `\n\n<code>${escapedPayload.slice(0, 2000)}</code>` : "");

      // если caption урезался для фото — длинный payload отправим отдельно реплаем
      const payloadLong =
        escapedPayload && escapedPayload.length > 0
          ? `<b>Полный payload:</b>\n<code>${escapedPayload.slice(0, 3500)}</code>`
          : undefined;

      const photoUrl = await normalizePhotoUrl(qr_image_b64);

      const resTg = await notifyAdmin({
        botToken: TG_BOT_TOKEN,
        chatId: ADMIN_TG_ID,
        caption,
        photoUrl,
        payloadLongText: payloadLong,
        requestId: requestId,
      });

      adminNotified = resTg.ok;
      telegram_debug = resTg.debug;
      
      // Отладочная информация
      console.log('Admin notification result:', {
        ok: resTg.ok,
        debug: resTg.debug,
        requestId,
        hasPhoto: !!photoUrl,
        captionLength: caption.length
      });
    } catch (e: any) {
      console.error("Admin notification failed:", e);
      telegram_debug = { ok: false, error: e?.message || "Unknown error" };
    }
  } else {
    telegram_debug = { ok: false, description: "No TG_BOT_TOKEN or ADMIN_TG_ID in env" };
  }

  return res.status(200).json({
    ok: true,
    id: requestId,
    admin_notified: adminNotified,
    telegram_debug,
  });
}
