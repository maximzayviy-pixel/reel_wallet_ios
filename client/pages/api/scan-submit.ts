// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

type ReqBody = {
  tg_id?: string | number;
  user_id?: string | number; // из твоего сканера
  qr_payload?: string;
  amount_rub?: number | string | null;
  max_limit_rub?: number | string | null;
  image_url?: string | null;
  qr_image_b64?: string | null; // из твоего сканера (data:image/jpeg;base64,...)
};

function asNumber(x: any): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const {
      tg_id,
      user_id,
      qr_payload,
      amount_rub,
      max_limit_rub,
      image_url,
      qr_image_b64,
    } = (req.body || {}) as ReqBody;

    // Совместимость: принимаем и tg_id, и user_id (как у тебя в сканере)
    const tgId = String(tg_id ?? user_id ?? "").trim();
    const amountRub = asNumber(amount_rub);
    const maxLimitRub = asNumber(max_limit_rub);

    if (!tgId || !qr_payload || !amountRub || amountRub <= 0) {
      return res.status(400).json({ ok: false, error: "tg_id, qr_payload, amount_rub are required" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      // Без базы всё равно вернём ОК, чтобы не блокировать UX
      return res.status(200).json({ ok: true, id: null, admin_notified: false, warn: "no_supabase_env" });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

    // 1) Проверка баланса пользователя (таблица balances: tg_id text, stars numeric, ton numeric)
    let stars = 0, ton = 0;
    {
      const { data: bal } = await supabase
        .from("balances")
        .select("stars, ton")
        .eq("tg_id", tgId)
        .maybeSingle();
      stars = Number(bal?.stars || 0);
      ton = Number(bal?.ton || 0);
    }
    const rubFromStars = stars / 2;   // 2⭐ = 1₽
    const rubFromTon = ton * 300;     // 1 TON = 300₽
    const totalRub = rubFromStars + rubFromTon;

    if (totalRub < amountRub) {
      return res.status(402).json({ ok: false, error: "INSUFFICIENT_FUNDS", have_rub: totalRub, need_rub: amountRub });
    }

    // 2) Если пришла картинка base64 — зальём в Supabase Storage (опционально)
    let finalImageUrl: string | null = image_url || null;
    if (!finalImageUrl && qr_image_b64 && qr_image_b64.startsWith("data:image")) {
      try {
        const bucket = process.env.SUPABASE_QR_BUCKET || "qr";
        // убедимся что bucket существует
        await supabase.storage.createBucket(bucket, { public: true }).catch(() => {});
        const b64 = qr_image_b64.split(",")[1];
        const bytes = Buffer.from(b64, "base64");
        const key = `qr_${tgId}_${Date.now()}.jpg`;
        const up = await supabase.storage.from(bucket).upload(key, bytes, { contentType: "image/jpeg", upsert: true });
        if (!up.error) {
          const { data: pub } = supabase.storage.from(bucket).getPublicUrl(key);
          finalImageUrl = pub?.publicUrl || null;
        }
      } catch {
        // проглатываем — не критично
      }
    }

    // 3) Создаём заявку в payment_requests
    const { data: ins, error: insErr } = await supabase
      .from("payment_requests")
      .insert([{
        tg_id: tgId,
        qr_payload,
        amount_rub: amountRub,
        max_limit_rub: maxLimitRub ?? amountRub,
        status: "pending",
        image_url: finalImageUrl,
      }])
      .select("id")
      .single();

    if (insErr) {
      return res.status(500).json({ ok: false, error: insErr.message || "insert_failed" });
    }

    // 4) Оповестим админа
    const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
    const ADMIN_TG_ID = process.env.ADMIN_TG_ID || "";
    let adminNotified = false;
    if (TG_BOT_TOKEN && ADMIN_TG_ID) {
      const caption =
        `<b>#${ins.id}</b>\n` +
        `Запрос оплаты от <code>${tgId}</code>\n` +
        `Сумма: <b>${amountRub} ₽</b>\n\n` +
        (qr_payload?.length ? `<code>${qr_payload.slice(0, 3500)}</code>` : "");

      try {
        if (finalImageUrl) {
          await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: ADMIN_TG_ID, photo: finalImageUrl, caption, parse_mode: "HTML" }),
          });
        } else {
          await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: ADMIN_TG_ID, text: caption, parse_mode: "HTML" }),
          });
        }
        adminNotified = true;
      } catch {
        adminNotified = false;
      }
    }

    return res.status(200).json({ ok: true, id: ins.id, admin_notified: adminNotified });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}