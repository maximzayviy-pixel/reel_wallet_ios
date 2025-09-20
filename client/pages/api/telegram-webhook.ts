// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

type TGUpdate = {
  message?: any;
  edited_message?: any;
  pre_checkout_query?: {
    id: string;
    from: { id: number };
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
};

const ok = (res: NextApiResponse, body: any = { ok: true }) => res.status(200).json(body);
const runQuickly = <T,>(p: Promise<T>, ms = 800) =>
  Promise.race([p, new Promise<T | undefined>(r => setTimeout(() => r(undefined as any), ms))]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET удобно для быстрой проверки
  if (req.method === 'GET') return ok(res, { ok: true });
  // Telegram ретраит при не-200, поэтому отвечаем сразу
  if (req.method !== 'POST') return ok(res);

  // (опционально) секрет вебхука
  const requiredSecret = process.env.TG_WEBHOOK_SECRET;
  const gotSecret = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  if (requiredSecret && gotSecret !== requiredSecret) return ok(res); // не ретраим

  // мгновенный ответ
  ok(res);

  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

  const LEDGER = process.env.TABLE_LEDGER || 'ledger';

  const update = (req.body || {}) as TGUpdate;
  const supabase =
    SUPABASE_URL && SUPABASE_SERVICE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
      : null;

  try {
    // 1) Подтверждаем pre_checkout_query
    if (update.pre_checkout_query && TG_BOT_TOKEN) {
      const pcq = update.pre_checkout_query;
      await runQuickly(
        fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerPreCheckoutQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pre_checkout_query_id: pcq.id, ok: true }),
        })
      );
    }

    // 2) Успешный платеж Stars
    const msg = update.message || update.edited_message;
    const sp = msg?.successful_payment;
    if (sp && supabase) {
      const fromId = Number(msg?.from?.id || 0);
      const currency = sp.currency;               // обычно 'XTR'
      const total = Number(sp.total_amount || 0); // для Stars — это кол-во звёзд
      if (fromId && currency === 'XTR' && total > 0) {
        // нормализуем вход
        const stars = total;
        const amountRub = stars / 2;         // ваш курс 2⭐ = 1₽
        const rate = 0.5;

        // пишем ТОЛЬКО в ledger — balances_by_tg всё сам посчитает
        await supabase.from(LEDGER).insert([{
          tg_id: fromId,
          type: 'stars_topup',
          asset_amount: stars,       // звёзды
          amount_rub: amountRub,     // рублёвый эквивалент
          rate_used: rate,
          status: 'ok',
          metadata: sp,
        }]);

        // (не обязательно) телеметрия
        try {
          await supabase.from('webhook_logs').insert([{
            kind: 'successful_payment',
            tg_id: fromId,
            payload: sp
          }]);
        } catch {}

        // (не обязательно) уведомление пользователю
        if (TG_BOT_TOKEN) {
          await runQuickly(
            fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: fromId,
                text: `⭐ Оплата получена: +${stars}⭐. Баланс обновится в приложении.`,
              }),
            })
          );
        }
      }
    }
  } catch (e: any) {
    console.error('webhook error:', e?.message || e);
    // не даём TG ретраить — ответ уже отправлен
  }
}
