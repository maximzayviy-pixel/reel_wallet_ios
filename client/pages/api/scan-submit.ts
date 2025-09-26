// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

function pickSbpUrlFromPayload(payload: string): string | null {
  if (!payload) return null;
  // 1) прямой url внутри текста
  const m = payload.match(/https?:\/\/qr\.nspk\.ru\/[A-Za-z0-9]+(?:\?[^\s<">]*)?/i);
  if (m) return m[0];
  // 2) intent://qr.nspk.ru/...#Intent;... — вытащим https-часть
  const m2 = payload.match(/(https?:\/\/qr\.nspk\.ru\/[A-Za-z0-9]+(?:\?[^\s<">]*)?)/i);
  if (m2) return m2[1];
  return null;
}

function dataUrlToBuffer(dataUrl: string): { buf: Buffer; mime: string; ext: string } {
  const [header, base64] = dataUrl.split(",");
  if (!header || !base64) throw new Error("Bad data URL");
  const mime = (/data:(.*?);base64/.exec(header)?.[1] || "image/jpeg").toLowerCase();
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return { buf: Buffer.from(base64, "base64"), mime, ext };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("no_supabase_env");
    // не ломаем поток — но возвращаем ok с warn, как и раньше
    return res.status(200).json({ ok: true, warn: "no_supabase_env" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const {
    tg_id,
    qr_payload,
    amount_rub,
    qr_image_b64,
    force_notify,
  } = req.body as {
    tg_id?: number | string;
    qr_payload?: string;
    amount_rub?: number;
    qr_image_b64?: string; // data:... или http(s) url
    force_notify?: boolean; // ручная заявка — обходим баланс-чек
  };

  if (!tg_id || !qr_payload || !amount_rub) {
    return res.status(400).json({ ok: false, error: "tg_id, qr_payload, amount_rub are required" });
  }

  // 1) user uuid
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("tg_id", tg_id)
    .maybeSingle();
  if (userErr) {
    console.error("user lookup error", userErr);
    return res.status(500).json({ ok: false, error: userErr.message });
  }
  if (!userRow) {
    console.error("402 NO_USER", { tgId: tg_id });
    return res.status(402).json({ ok: false, reason: "NO_USER" });
  }

  // 2) баланс (можно пропустить для ручных заявок force_notify === true)
  if (!force_notify) {
    try {
      const { data: balRow, error: balErr } = await supabase
        .from("balances_by_tg")
        .select("stars")
        .eq("tg_id", tg_id)
        .maybeSingle();
      if (balErr) console.error("balance lookup error", balErr);
      if (!balRow) return res.status(402).json({ ok: false, reason: "NO_USER" });

      const needStars = Math.round(amount_rub * 2);
      if (balRow.stars < needStars) {
        return res
          .status(402)
          .json({ ok: false, reason: "INSUFFICIENT_BALANCE", need: needStars, have: balRow.stars });
      }
    } catch (e) {
      console.error("Balance check failed", e);
      // баланс не критичный — не роняем заявку
    }
  }

  // 3) пишем заявку (сохраняем минимум, не трогаем схему)
  const { data: ins, error: insErr } = await supabase
    .from("payment_requests")
    .insert([{ tg_id, user_id: userRow.id, qr_payload, amount_rub, status: "pending" }])
    .select()
    .single();
  if (insErr) {
    console.error("insert_failed", insErr);
    return res.status(500).json({ ok: false, error: insErr.message });
  }

  // 4) уведомляем админа
  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
  const ADMIN_TG_ID = process.env.ADMIN_TG_ID || process.env.TELEGRAM_ADMIN_CHAT || "";
  let adminNotified = false;
  let telegram_debug: any = null;

  // Если нет токена/чата — вернём предупреждение, чтобы на фронте было видно причину
  if (!TG_BOT_TOKEN || !ADMIN_TG_ID) {
    console.warn("telegram_env_missing", { hasToken: !!TG_BOT_TOKEN, hasAdmin: !!ADMIN_TG_ID });
    return res.status(200).json({
      ok: true,
      id: ins.id,
      admin_notified: false,
      telegram_debug: { ok: false, description: "TG_BOT_TOKEN or ADMIN_TG_ID missing" },
    });
  }

  const sbpUrl = pickSbpUrlFromPayload(qr_payload);
  const urlLine = sbpUrl
    ? `\n<a href="${sbpUrl}">Оплатить в банке</a>`
    : "\nQR не содержит функциональной ссылки СБП";
  const caption =
    `<b>#${ins.id}</b>\n` +
    `Запрос оплаты от <code>${tg_id}</code>\n` +
    `Сумма: <b>${amount_rub} ₽</b> (${Math.round(amount_rub * 2)} ⭐)` +
    urlLine +
    (qr_payload?.length ? `\n\n<code>${qr_payload.slice(0, 2000)}</code>` : "");

  const reply_markup = {
    inline_keyboard: [
      [
        { text: "✅ Оплачено", callback_data: `pay:${ins.id}` },
        { text: "❌ Отказать", callback_data: `rej:${ins.id}` },
      ],
    ],
  };

  async function sendTelegramPhotoFromHttpUrl(photoUrl: string) {
    const resp = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_TG_ID,
        photo: photoUrl,
        caption,
        parse_mode: "HTML",
        reply_markup,
        disable_web_page_preview: true,
      }),
    });
    return resp;
  }

  async function sendTelegramPhotoFromDataUrl(dataUrl: string) {
    // multipart/form-data с бинарником
    const { buf, mime, ext } = dataUrlToBuffer(dataUrl);
    const form = new FormData();
    form.append("chat_id", String(ADMIN_TG_ID));
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("reply_markup", JSON.stringify(reply_markup));
    // Важно: имя файла с расширением
    form.append("photo", new Blob([buf], { type: mime }), `qr.${ext}`);

    const resp = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      body: form,
    });
    return resp;
  }

  try {
    let resp;
    const isHttpUrl = typeof qr_image_b64 === "string" && /^https?:\/\//i.test(qr_image_b64);
    const isDataUrl = typeof qr_image_b64 === "string" && /^data:image\//i.test(qr_image_b64);

    if (isHttpUrl) {
      // Готовая ссылка (например, Uploadcare CDN) — шлём как фото
      resp = await sendTelegramPhotoFromHttpUrl(qr_image_b64!);
    } else if (isDataUrl) {
      // data URL — шлём multipart как файл
      resp = await sendTelegramPhotoFromDataUrl(qr_image_b64!);
    } else {
      // Нет фото → отправляем текст (как и раньше)
      resp = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_TG_ID,
          text: caption,
          parse_mode: "HTML",
          reply_markup,
          disable_web_page_preview: true,
        }),
      });
    }

    const j = await resp.json().catch(() => ({}));
    telegram_debug = { ok: j?.ok, error_code: j?.error_code, description: j?.description };
    adminNotified = !!j?.ok;

    if (!adminNotified) {
      console.error("telegram_send_failed", telegram_debug);
    }
  } catch (e: any) {
    telegram_debug = { ok: false, exception: String(e) };
    adminNotified = false;
    console.error("telegram_exception", e);
  }

  // статус «ожидаем» для юзера — сразу
  return res.status(200).json({ ok: true, id: ins.id, admin_notified: adminNotified, telegram_debug });
}
