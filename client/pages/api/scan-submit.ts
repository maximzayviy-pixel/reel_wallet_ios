// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

function pickSbpUrlFromPayload(payload: string): string | null {
  if (!payload) return null;
  // 1) прямой url внутри текста
  const m = payload.match(/https?:\/\/qr\.nspk\.ru\/[A-Za-z0-9]+(?:\?[^\s<">]*)?/i);
  if (m) return m[0];
  // 2) иногда payload = intent://qr.nspk.ru/...#Intent;... — вытащим https-часть
  const m2 = payload.match(/(https?:\/\/qr\.nspk\.ru\/[A-Za-z0-9]+(?:\?[^\s<">]*)?)/i);
  if (m2) return m2[1];
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("no_supabase_env");
    return res.status(200).json({ ok: true, warn: "no_supabase_env" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const { tg_id, qr_payload, amount_rub, qr_image_b64, force_notify } = req.body as {
    tg_id?: number | string;
    qr_payload?: string;
    amount_rub?: number;
    qr_image_b64?: string; // data:... или http(s) url (редко)
    force_notify?: boolean; // <— ДОБАВЛЕНО: форсить уведомление админа даже при нехватке ⭐
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

  // 2) баланс из balances_by_tg
  let warnInsufficient = false; // <— ДОБАВЛЕНО: запомним, если не хватает ⭐
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
      // СТАРОЕ ПОВЕДЕНИЕ СОХРАНЕНО по умолчанию:
      if (!force_notify) {
        return res.status(402).json({ ok: false, reason: "INSUFFICIENT_BALANCE", need: needStars, have: balRow.stars });
      }
      // НОВОЕ: если передан force_notify=true — продолжаем, уведомим админа и отметим предупреждение
      warnInsufficient = true;
    }
  } catch (e) {
    console.error("Balance check failed", e);
  }

  // 3) пишем заявку (как было; схему не меняю)
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

  if (TG_BOT_TOKEN && ADMIN_TG_ID) {
    const sbpUrl = pickSbpUrlFromPayload(qr_payload);
    const urlLine = sbpUrl ? `\n<a href="${sbpUrl}">Оплатить в банке</a>` : "\nQR не содержит функциональной ссылки СБП";
    const caption =
      `<b>#${ins.id}</b>\n` +
      `Запрос оплаты от <code>${tg_id}</code>\n` +
      `Сумма: <b>${amount_rub} ₽</b> (${Math.round(amount_rub * 2)} ⭐)` +
      (warnInsufficient ? `\n⚠️ Недостаточно ⭐ у пользователя` : "") + // <— ДОБАВЛЕНО
      urlLine +
      (qr_payload?.length ? `\n\n<code>${qr_payload.slice(0, 2000)}</code>` : "");

    const reply_markup = {
      inline_keyboard: [[{ text: "✅ Оплачено", callback_data: `pay:${ins.id}` }, { text: "❌ Отказать", callback_data: `rej:${ins.id}` }]],
    };

    try {
      let resp;
      const isHttpUrl = typeof qr_image_b64 === "string" && /^https?:\/\//i.test(qr_image_b64);
      if (isHttpUrl) {
        resp = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: ADMIN_TG_ID, photo: qr_image_b64, caption, parse_mode: "HTML", reply_markup }),
        });
      } else {
        // base64 data:* или нет фото → надёжно шлём текст
        resp = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: ADMIN_TG_ID, text: caption, parse_mode: "HTML", reply_markup }),
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

  // статус «ожидаем» для юзера — сразу
  return res.status(200).json({ ok: true, id: ins.id, admin_notified: adminNotified, telegram_debug });
}
