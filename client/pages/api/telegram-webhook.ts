import type { NextApiRequest, NextApiResponse } from "next";

const BOT_TOKEN = process.env.TG_BOT_TOKEN!; // у вас переменная называлась TG_BOT_TOKEN
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Разрешим GET для ручной проверки (вернёт ok: true), а POST — для Telegram
  if (req.method === "GET") return res.status(200).json({ ok: true });

  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  // (опц.) проверка секрета
  if (WEBHOOK_SECRET) {
    const got = req.headers["x-telegram-bot-api-secret-token"];
    if (got !== WEBHOOK_SECRET) return res.status(403).end("forbidden");
  }

  // ответим Telegram СРАЗУ, чтобы не крутилось
  res.status(200).json({ ok: true });

  const update = req.body || {};

  try {
    // 1) Подтверждение оплаты (обязательно и быстро!)
    if (update.pre_checkout_query) {
      const id = update.pre_checkout_query.id;
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pre_checkout_query_id: id, ok: true })
      });
      return;
    }

    // 2) Успешный платёж — начисляем баланс и уведомляем
    const msg = update.message;
    if (msg?.successful_payment) {
      const tg_id = msg.from?.id;
      const totalStars = msg.successful_payment.total_amount; // в звёздах
      // TODO: начисление в базе (Supabase): увеличьте баланс пользователя
      // await supabase.rpc('add_stars', { tg_id, stars: totalStars });

      // Сообщение пользователю
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tg_id,
          text: `✅ Оплата на ${totalStars}⭐ прошла успешно! Баланс будет обновлён в приложении.`
        })
      });
      return;
    }
  } catch (e) {
    // без логов, чтобы не мешать 200-ответу
  }
}
