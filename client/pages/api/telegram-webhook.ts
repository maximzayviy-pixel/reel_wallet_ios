// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    // Телеграм периодически может дергать GET — просто отвечаем ок
    return res.status(200).json({ ok: true });
  }

  // Мгновенный ответ Telegram, чтобы не было «долгой загрузки»
  res.status(200).json({ ok: true });

  try {
    const update = req.body || {};
    const msg = update.message || update.edited_message;
    const sp = msg?.successful_payment;
    const fromId = msg?.from?.id ? Number(msg.from.id) : undefined;

    // Интересуют только успешные платежи Stars
    if (!sp || !fromId) return;

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // total_amount для Stars = кол-во звезд
    const stars = Number(sp.total_amount || 0);
    if (!stars || stars <= 0) return;

    // Запись в ledger: этого достаточно, чтобы VIEW balances_by_tg посчитала баланс
    try {
      await supabase.from("ledger").insert([
        {
          tg_id: fromId,               // bigint
          type: "stars_topup",         // text
          asset_amount: stars,         // numeric — звезды
          amount_rub: stars / 2,       // numeric — пересчет в ₽
          rate_used: 2,                // numeric — 2 ⭐ = 1 ₽
          status: "done",              // text
          metadata: sp,                // jsonb — сырое тело successful_payment
        },
      ]);
    } catch (e) {
      console.error("ledger insert failed:", e);
    }

    // Необязательная телеметрия (если есть таблица)
    try {
      await supabase.from("webhook_logs").insert([
        { kind: "successful_payment", tg_id: fromId, payload: sp },
      ]);
    } catch {
      // пропускаем, если таблицы нет / RLS
    }
  } catch (e) {
    console.error("webhook handler error:", e);
  }
}
