// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// --- API config (большие QR-скриншоты в data:)
export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

// -------------------------------
// helpers
// -------------------------------

/** Нормализуем payload и достаём NSPK-URL (если есть) */
function normalizeQrPayload(payload: string) {
  const original = String(payload ?? "");
  const trimmed = original.trim();
  const re = /(https?:\/\/qr\.nspk\.ru\/[A-Za-z0-9/_-]+(?:\?[^ \n\r<">#]*)?)/i;
  const m = trimmed.match(re);
  const sbpUrl = m?.[1] ?? null;
  return { original, trimmed, sbpUrl };
}

/** Старый селектор, оставлен как бэкап */
function pickSbpUrlFromPayload(payload: string): string | null {
  if (!payload) return null;
  const re = /(https?:\/\/qr\.nspk\.ru\/[A-Za-z0-9/_-]+(?:\?[^ \n\r<">#]*)?)/i;
  const m = payload.match(re);
  return m ? m[1] : null;
}

/** Безопасный number */
function toNumber(n: unknown): number | null {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string" && n.trim() !== "" && !Number.isNaN(Number(n))) return Number(n);
  return null;
}

/** Ответ с JSON */
function sendJSON(res: NextApiResponse, code: number, body: any) {
  res.status(code).json(body);
}

/** CORS */
function applyCors(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

/** Markdown-подпись для Телеграм */
function buildAdminCaption(opts: {
  id: number | string;
  tg_id: string | number;
  amount_rub: number;
  sbpUrl?: string | null;
  qr_payload_preview?: string;
}) {
  const stars = Math.round(opts.amount_rub * 2);
  const urlLine = opts.sbpUrl ? `\n<a href="${opts.sbpUrl}">Оплатить в банке</a>` : "\nQR не содержит функциональной ссылки СБП";
  const preview =
    opts.qr_payload_preview && opts.qr_payload_preview.length
      ? `\n\n<code>${opts.qr_payload_preview}</code>`
      : "";
  return (
    `<b>#${opts.id}</b>\n` +
    `Запрос оплаты от <code>${opts.tg_id}</code>\n` +
    `Сумма: <b>${opts.amount_rub} ₽</b> (${stars} ⭐)` +
    urlLine +
    preview
  );
}

/** Парсинг data:image/...;base64,*** */
function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } | null {
  try {
    const m = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i);
    if (!m) return null;
    const contentType = m[1].toLowerCase();
    const base64 = m[2];
    const buffer = Buffer.from(base64, "base64");
    let ext = "png";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
    else if (contentType.includes("webp")) ext = "webp";
    else if (contentType.includes("png")) ext = "png";
    else if (contentType.includes("gif")) ext = "gif";
    return { buffer, contentType, ext };
  } catch {
    return null;
  }
}

/** Загрузка в Supabase Storage с получением публичной (или подписанной) ссылки */
async function uploadToStorageAndGetUrl(args: {
  supabase: SupabaseClient;
  bucket: string;
  path: string;
  data: Buffer;
  contentType: string;
}): Promise<string | null> {
  const { supabase, bucket, path, data, contentType } = args;

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, data, {
    contentType,
    upsert: false,
  });

  if (upErr) {
    const code =
      "status" in upErr
        ? (upErr as any).status
        : "statusCode" in upErr
        ? (upErr as any).statusCode
        : null;

    if (code !== 409 && code !== "409") {
      console.error("storage upload error", upErr);
      return null;
    }
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  if (pub?.publicUrl) return pub.publicUrl;

  const { data: signed, error: signedErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24);
  if (signedErr) {
    console.error("signed url error", signedErr);
    return null;
  }
  return signed?.signedUrl ?? null;
}

// -------------------------------
// handler
// -------------------------------

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST,OPTIONS");
    return sendJSON(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  // env
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
  const ADMIN_TG_ID = process.env.ADMIN_TG_ID || process.env.TELEGRAM_ADMIN_CHAT || "";
  const SUPABASE_BUCKET_QR = process.env.SUPABASE_BUCKET_QR || "qr-images";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("no_supabase_env");
    return sendJSON(res, 200, { ok: true, warn: "no_supabase_env" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // input
  const { tg_id, qr_payload, amount_rub, qr_image_b64 } = (req.body || {}) as {
    tg_id?: number | string;
    qr_payload?: string;
    amount_rub?: number | string;
    qr_image_b64?: string;
  };

  const amountNum = toNumber(amount_rub);
  if (!tg_id || !qr_payload || amountNum === null) {
    return sendJSON(res, 400, { ok: false, error: "tg_id, qr_payload, amount_rub are required" });
  }

  // нормализация QR payload
  const normalized = normalizeQrPayload(qr_payload);
  const sbpUrl = normalized.sbpUrl || pickSbpUrlFromPayload(qr_payload);

  // 1) user by tg_id
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("tg_id", tg_id)
    .maybeSingle();
  if (userErr) {
    console.error("user lookup error", userErr);
    return sendJSON(res, 500, { ok: false, error: userErr.message });
  }
  if (!userRow) {
    console.error("402 NO_USER", { tgId: tg_id });
    return sendJSON(res, 402, { ok: false, reason: "NO_USER" });
  }

  // 2) баланс
  try {
    const { data: balRow, error: balErr } = await supabase
      .from("balances_by_tg")
      .select("stars")
      .eq("tg_id", tg_id)
      .maybeSingle();
    if (balErr) console.error("balance lookup error", balErr);
    if (!balRow) return sendJSON(res, 402, { ok: false, reason: "NO_USER" });

    const needStars = Math.round(amountNum * 2);
    if (balRow.stars < needStars) {
      return sendJSON(res, 402, { ok: false, reason: "INSUFFICIENT_BALANCE", need: needStars, have: balRow.stars });
    }
  } catch (e) {
    console.error("Balance check failed", e);
  }

  // 3) вставка заявки
  const payloadPreview = normalized.original.slice(0, 2000);
  const insertRow: any = {
    tg_id,
    user_id: userRow.id,
    qr_payload: normalized.original,
    amount_rub: amountNum,
    status: "pending",
  };
  if (sbpUrl) insertRow.sbp_url = sbpUrl;

  const { data: ins, error: insErr } = await supabase.from("payment_requests").insert([insertRow]).select().single();
  if (insErr) {
    console.error("insert_failed", insErr);
    return sendJSON(res, 500, { ok: false, error: insErr.message });
  }

  // 4) загрузка картинки
  let uploadedPhotoUrl: string | null = null;
  const isHttpUrl = typeof qr_image_b64 === "string" && /^https?:\/\//i.test(qr_image_b64);
  const isDataUrl = typeof qr_image_b64 === "string" && /^data:image\//i.test(qr_image_b64);

  if (isDataUrl) {
    const parsed = parseDataUrl(qr_image_b64!);
    if (parsed) {
      const filename = `${ins.id}-${Date.now()}.${parsed.ext}`;
      const path = `requests/${filename}`;
      try {
        uploadedPhotoUrl = await uploadToStorageAndGetUrl({
          supabase,
          bucket: SUPABASE_BUCKET_QR,
          path,
          data: parsed.buffer,
          contentType: parsed.contentType,
        });
      } catch (e) {
        console.error("storage upload failed", e);
      }
    }
  }

  // 5) уведомляем админа
  let adminNotified = false;
  let telegram_debug: any = null;

  if (TG_BOT_TOKEN && ADMIN_TG_ID) {
    const caption = buildAdminCaption({
      id: ins.id,
      tg_id: tg_id!,
      amount_rub: amountNum!,
      sbpUrl,
      qr_payload_preview: payloadPreview,
    });

    try {
      let resp: Response;

      if (isHttpUrl) {
        resp = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: ADMIN_TG_ID,
            photo: qr_image_b64,
            caption,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "✅ Оплачено", callback_data: `pay:${ins.id}` },
                { text: "❌ Отказать", callback_data: `rej:${ins.id}` }
              ]],
            },
          }),
        });
      } else if (uploadedPhotoUrl) {
        resp = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: ADMIN_TG_ID,
            photo: uploadedPhotoUrl,
            caption,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "✅ Оплачено", callback_data: `pay:${ins.id}` },
                { text: "❌ Отказать", callback_data: `rej:${ins.id}` }
              ]],
            },
          }),
        });
      } else {
        resp = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: ADMIN_TG_ID,
            text: caption,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "✅ Оплачено", callback_data: `pay:${ins.id}` },
                { text: "❌ Отказать", callback_data: `rej:${ins.id}` }
              ]],
            },
          }),
        });
      }

      const j = await resp.json().catch(() => ({}));
      telegram_debug = { ok: j?.ok, error_code: j?.error_code, description: j?.description };
      adminNotified = !!j?.ok;
    } catch (e: any) {
      telegram_debug = { ok: false, exception: String(e) };
      adminNotified = false;
    }
  }

  // 6) ответ
  return sendJSON(res, 200, {
    ok: true,
    id: ins.id,
    admin_notified: adminNotified,
    telegram_debug,
    sbp_url: sbpUrl ?? null,
    photo_url: uploadedPhotoUrl ?? (isHttpUrl ? qr_image_b64! : null),
  });
}
