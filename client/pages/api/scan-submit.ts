// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("no_supabase_env");
    return res.status(200).json({ ok: true, warn: "no_supabase_env" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { tg_id, qr_payload, amount_rub, qr_image_b64 } = req.body as {
    tg_id?: number;
    qr_payload?: string;
    amount_rub?: number;
    qr_image_b64?: string;
  };

  if (!tg_id || !qr_payload || !amount_rub) {
    return res.status(400).json({ ok: false, error: "tg_id, qr_payload, amount_rub are required" });
  }

  // --- Balance validation ---
  try {
    const { data: userRow } = await supabase
      .from("users")
      .select("id,balance_stars")
      .eq("tg_id", tg_id)
      .maybeSingle();

    if (!userRow) {
      console.error("402 NO_USER", { tgId: tg_id });
      return res.status(402).json({ ok: false, reason: "NO_USER" });
    }

    const needStars = Math.round(amount_rub * 2);
    if (userRow.balance_stars < needStars) {
      console.error("402 INSUFFICIENT_BALANCE", {
        tgId: tg_id,
        need: needStars,
        have: userRow.balance_stars,
      });
      return res.status(402).json({
        ok: false,
        reason: "INSUFFICIENT_BALANCE",
        need: needStars,
        have: userRow.balance_stars,
      });
    }
  } catch (e) {
    console.error("Balance check failed", e);
  }
  // --- End balance validation ---

  // 3) Запишем заявку
  const { data: ins, error: insErr } = await supabase
    .from("payment_requests")
    .insert([
      {
        tg_id,
        user_id: tg_id,
        qr_payload,
        amount_rub,
        status: "pending",
      },
    ])
    .select()
    .single();

  if (insErr) {
    console.error("insert_failed", insErr);
    return res.status(500).json({ ok: false, error: insErr.message });
  }

  // 4) Оповестим админа + inline-кнопки
  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
  const ADMIN_TG_ID = process.env.ADMIN_TG_ID || process.env.TELEGRAM_ADMIN_CHAT || "";
  let adminNotified = false;

  if (TG_BOT_TOKEN && ADMIN_TG_ID) {
    const caption =
      `<b>#${ins.id}</b>\n` +
      `Запрос оплаты от <code>${tg_id}</code>\n` +
      `Сумма: <b>${amount_rub} ₽</b> (${Math.round(amount_rub * 2)} ⭐)\n\n` +
      (qr_payload?.length ? `<code>${qr_payload.slice(0, 3500)}</code>` : "");

    const reply_markup = {
      inline_keyboard: [
        [
          { text: "✅ Оплачено", callback_data: `pay:${ins.id}` },
          { text: "❌ Отказать", callback_data: `rej:${ins.id}` },
        ],
      ],
    };

    try {
      let sent;
      if (qr_image_b64) {
        sent = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: ADMIN_TG_ID,
            photo: qr_image_b64,
            caption,
            parse_mode: "HTML",
            reply_markup,
          }),
        });
      } else {
        sent = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: ADMIN_TG_ID,
            text: caption,
            parse_mode: "HTML",
            reply_markup,
          }),
        });
      }
      const j = await sent.json().catch(() => ({}));
      adminNotified = !!j?.ok;
    } catch {
      adminNotified = false;
    }
  }

  return res.status(200).json({ ok: true, id: ins.id, admin_notified: adminNotified });
}
