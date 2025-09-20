// client/pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const BOT = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
  : null;

// Helper: fire-and-forget with timeout
function runQuickly<T>(p: Promise<T>, ms = 800) {
  return Promise.race([p, new Promise<T>((resolve)=> setTimeout(()=>resolve(undefined as any), ms))]);
}

async function processUpdate(update: any) {
  if (!BOT) return;

  try {
    // 1) PreCheckout — нужно отвечать быстро, иначе у юзера «вечная загрузка»
    if (update.pre_checkout_query) {
      const pcq = update.pre_checkout_query;
      await runQuickly(fetch(`https://api.telegram.org/bot${BOT}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_checkout_query_id: pcq.id, ok: true })
      }));
      return;
    }

    // 2) Успешный платёж (в т.ч. Stars/XTR)
    const msg = update.message || update.edited_message;
    if (msg?.successful_payment) {
      const sp = msg.successful_payment;
      const fromId = msg.from?.id;
      const currency = sp.currency;                     // 'XTR' для звёзд
      const total = Number(sp.total_amount || 0);       // минимальные единицы валюты
      // Для XTR считаем, что total_amount == кол-во звёзд
      const stars = currency === 'XTR' ? total : 0;

      // Пишем в БД (по возможности быстро, одной транзакцией)
      if (supabase && fromId && stars > 0) {
        // users.stars += stars
        await runQuickly(
          supabase.rpc('reel_add_stars', { i_tg_id: fromId, i_delta: stars })
          .catch(async () => {
            // запасной вариант без RPC
            await supabase.from('users').upsert({ tg_id: fromId, stars: stars }, { onConflict: 'tg_id' });
          })
        );
        // лог пополнения
        await runQuickly(
          supabase.from('topups').insert([{
            tg_id: fromId, amount_stars: stars, raw: sp
          }])
        );
      }

      // Ответ пользователю
      await runQuickly(fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: fromId,
          text: `⭐ Оплата получена: +${stars}⭐. Баланс будет обновлён в приложении.`
        })
      }));
      return;
    }

    // 3) Команда /start — пингуем
    if (update.message?.text === '/start') {
      const chatId = update.message.chat.id;
      await runQuickly(fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: 'Webhook жив ✅' })
      }));
      return;
    }
  } catch (_) {
    // глушим ошибки — вебхук уже ответил 200
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // ВАЖНО: отвечаем СРАЗУ, чтобы TG не ожидал и не крутился
  res.status(200).json({ ok: true });

  // Обрабатываем «в фоне» — не ждём завершения
  const update = req.body || {};
  processUpdate(update); // без await
}

// Не нужен сырой body, обычный JSON пойдёт
export const config = { api: { bodyParser: true } };
