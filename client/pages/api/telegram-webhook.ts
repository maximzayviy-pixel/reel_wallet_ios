// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

type TGUpdate = {
  message?: any;
  edited_message?: any;
  pre_checkout_query?: { id: string };
};

function runQuickly<T>(p: Promise<T>, ms = 800): Promise<T | undefined> {
  return Promise.race([
    p,
    new Promise<T | undefined>((r) => setTimeout(() => r(undefined), ms)),
  ]) as Promise<T | undefined>;
}
const ok = (res: NextApiResponse, body: any = { ok: true }) => res.status(200).json(body);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return ok(res, { ok: true });
  if (req.method !== 'POST') return ok(res);

  const requiredSecret = process.env.TG_WEBHOOK_SECRET;
  const gotSecret = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  if (requiredSecret && gotSecret !== requiredSecret) {
    return res.status(403).json({ ok: false, error: 'bad secret' });
  }

  // моментально отвечаем Telegram
  ok(res);

  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
  const BALANCES = process.env.TABLE_BALANCES || 'balances';
  const LEDGER = process.env.TABLE_LEDGER || 'ledger';

  const update = (req.body || {}) as TGUpdate;

  const supabase =
    SUPABASE_URL && SUPABASE_SERVICE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
      : null;

  try {
    // 1) подтверждаем pre_checkout_query — иначе у юзера вечная «крутилка»
    if (update.pre_checkout_query && TG_BOT_TOKEN) {
      await runQuickly(
        fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerPreCheckoutQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true }),
        })
      );
    }

    // 2) успешный платёж (Stars / XTR)
    const msg = update.message || update.edited_message;
    const sp = msg?.successful_payment;
    if (sp && supabase) {
      const fromId = String(msg?.from?.id || '');
      const currency = sp.currency;                 // ожидаем 'XTR'
      const stars = currency === 'XTR' ? Number(sp.total_amount || 0) : 0;

      // (опционально) телеметрия
      try {
        await supabase.from('webhook_logs').insert([{ kind: 'successful_payment', tg_id: fromId, payload: sp }]);
      } catch {/* таблицы может не быть — пропускаем */}

      if (fromId && stars > 0) {
        // читаем текущий баланс
        let currentStars = 0;
        try {
          const { data: existing } = await supabase
            .from(BALANCES)
            .select('stars')
            .eq('tg_id', fromId)
            .maybeSingle();
          currentStars = Number(existing?.stars || 0);
        } catch {/* читаем best-effort */}

        const nextStars = currentStars + stars;

        // апдейт/апсерт (без RPC и без .catch())
        try {
          if (currentStars > 0) {
            await supabase.from(BALANCES).update({ stars: nextStars }).eq('tg_id', fromId);
          } else {
            await supabase
              .from(BALANCES)
              .upsert([{ tg_id: fromId, stars: nextStars, ton: 0 }], { onConflict: 'tg_id' });
          }
        } catch {
          await supabase
            .from(BALANCES)
            .upsert([{ tg_id: fromId, stars: nextStars, ton: 0 }], { onConflict: 'tg_id' });
        }

        // журнал (best-effort)
        try {
          await supabase.from(LEDGER).insert([{
            tg_id: fromId,
            type: 'stars_topup',
            amount: stars,
            meta: sp,
          }]);
        } catch {/* ок */}

        // уведомление пользователю (best-effort)
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
  } catch {
    // уже отдали 200 — не даём TG ретраить
  }
}
