// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: { bodyParser: true },
};

type TGUpdate = {
  update_id?: number;
  message?: any;
  edited_message?: any;
  pre_checkout_query?: {
    id: string;
    from: { id: number };
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
  callback_query?: any;
};

const ok = (res: NextApiResponse, body: any = { ok: true }) => res.status(200).json(body);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) Разрешаем GET для health/ping и проверок Telegram
  if (req.method === 'GET') return ok(res, { ok: true });

  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  // 2) (опционально) Проверка секрет-токена вебхука
  //    Если задашь TG_WEBHOOK_SECRET — обязательно передай его в setWebhook:
  //    setWebhook(..., { secret_token: '...' })
  const requiredSecret = process.env.TG_WEBHOOK_SECRET;
  const gotSecret = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  if (requiredSecret && gotSecret !== requiredSecret) {
    // Не роняем апдейты, но логично отбрасываем
    return res.status(403).json({ ok: false, error: 'bad secret' });
  }

  // 3) Подготовим окружение
  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const SUPABASE_URL = process.env.SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

  const BALANCES = process.env.TABLE_BALANCES || 'balances';
  const LEDGER = process.env.TABLE_LEDGER || 'ledger';

  let supabase = null as any;
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }

  const update = (req.body || {}) as TGUpdate;

  try {
    // 4) Обязательно отвечаем на pre_checkout_query — иначе «вечная крутилка»
    if (update.pre_checkout_query && TG_BOT_TOKEN) {
      const pcq = update.pre_checkout_query;

      // Если тут хочешь валидацию суммы/пэйлоада — сделай проверку и ок/не ok
      await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query_id: pcq.id,
          ok: true,
          // error_message: 'Что-то не так' // если надо вернуть ошибку
        }),
      }).catch(() => {});
      // Ответили — можно продолжать, но клиент уже не будет висеть
    }

    // 5) Обрабатываем успешный платеж (Stars)
    const msg = update.message || update.edited_message;
    if (msg?.successful_payment && supabase) {
      const tgId = String(msg?.from?.id || '');
      // Для Stars Telegram кладёт количество в total_amount
      const starsAmount = Number(msg.successful_payment?.total_amount || 0);

      if (tgId && starsAmount > 0) {
        // Прочитать текущее значение
        const { data: existing } = await supabase
          .from(BALANCES)
          .select('stars, ton')
          .eq('tg_id', tgId)
          .maybeSingle();

        const nextStars = Number(existing?.stars || 0) + starsAmount;

        if (existing) {
          await supabase.from(BALANCES).update({ stars: nextStars }).eq('tg_id', tgId);
        } else {
          await supabase.from(BALANCES).insert([{ tg_id: tgId, stars: nextStars, ton: 0 }]);
        }

        await supabase.from(LEDGER).insert([{
          tg_id: tgId,
          type: 'stars_topup',
          amount: starsAmount,
          meta: { raw: msg.successful_payment },
        }]);
      }
    }

    // 6) Всегда 200 OK, чтобы Telegram не ретраил апдейт
    return ok(res);
  } catch (err: any) {
    // Никогда не отдаём 500 Телеграму — пусть считает апдейт обработанным
    console.error('telegram-webhook error:', err?.message || err);
    return ok(res);
  }
}
