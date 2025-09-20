// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: true } };

type Body = {
  tg_id?: number | string;
  qr_payload?: string;
  amount_rub?: number | string;
  image_url?: string | null;
  max_limit_rub?: number | string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  try {
    const { tg_id, qr_payload, amount_rub, image_url, max_limit_rub } = (req.body || {}) as Body;

    const tgId = String(tg_id || "").trim();
    const payload = String(qr_payload || "").trim();
    const amount = Number(amount_rub);
    const limit = max_limit_rub == null ? null : Number(max_limit_rub);

    if (!tgId || !payload || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "tg_id, qr_payload, amount_rub are required" });
    }
    if (limit != null && amount > limit) {
      return res.status(422).json({ error: "AMOUNT_EXCEEDS_LIMIT" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: "Supabase creds missing" });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

    // 1) Проверка баланса (звёзды и TON конвертим в ₽: 2⭐=1₽, 1 TON=300₽)
    let stars = 0, ton = 0;
    try {
      const { data } = await supabase.from("balances").select("stars, ton").eq("tg_id", tgId).maybeSingle();
      stars = Number(data?.stars || 0);
      ton = Number(data?.ton || 0);
    } catch {}

    const rubFromStars = stars / 2;
    const rubFromTon = ton * 300;
    const totalRub = rubFromStars + rubFromTon;

    if (totalRub < amount) {
      return res.status(402).json({ error: "INSUFFICIENT_FUNDS", have_rub: totalRub, need_rub: amount });
    }

    // 2) Создаём заявку
    const { data: inserted, error } = await supabase
      .from("payment_requests")
      .insert([{
        tg_id: tgId,
        qr_payload: payload,
        amount_rub: amount,
        status: "pending",
        image_url: image_url || null
      }])
      .select("id")
      .maybeSingle();

    if (error || !inserted?.id) {
      return res.status(500).json({ error: "INSERT_FAILED", details: error?.message });
    }

    // 3) Нотификация админу
    const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
    const ADMIN_TG_ID = process.env.ADMIN_TG_ID || "";
    if (TG_BOT_TOKEN && ADMIN_TG_ID) {
      const caption =
        `<b>Новая заявка #${inserted.id}</b>\n` +
        `👤 tg_id: <code>${tgId}</code>\n` +
        `💳 сумма: <b>${amount.toFixed(2)} ₽</b>\n` +
        `🔗 QR/СБП: <code>${escapeHtml(payload).slice(0, 3500)}</code>`;

      try {
        if (image_url) {
          await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: ADMIN_TG_ID, photo: image_url, caption, parse_mode: "HTML" })
          });
        } else {
          await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: ADMIN_TG_ID, text: caption, parse_mode: "HTML" })
          });
        }
      } catch {}
    }

    return res.status(200).json({ ok: true, id: inserted.id, admin_notified: Boolean(process.env.ADMIN_TG_ID) });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
