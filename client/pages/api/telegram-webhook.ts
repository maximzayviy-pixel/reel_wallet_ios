// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

type TGUpdate = {
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };

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
  // GET — для быстрой проверки
  if (req.method === 'GET') return ok(res, { ok: true });
  // Телеграм ретраит при не-200, поэтому отвечаем сразу
  if (req.method !== 'POST') return ok(res);

  // (опционально) мягкий секрет вебхука — НЕ прерываем обработку
  const requiredSecret = process.env.TG_WEBHOOK_SECRET;
  const gotSecret = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  if (requiredSecret && gotSecret !== requiredSecret) {
    console.warn('telegram-webhook: secret mismatch', { haveEnv: !!requiredSecret, gotHeader: !!gotSecret });
    // не return — чтобы кнопки не зависали
  }

  // мгновенный HTTP-ответ — дальше исполняем «в фоне»
  ok(res);

  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  const LEDGER = process.env.TABLE_LEDGER || 'ledger';

  const update = (req.body || {}) as TGUpdate;
  const supabase =
    SUPABASE_URL && SUPABASE_SERVICE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
      : null;

  // -----------------[ INLINE-КНОПКИ АДМИНА ]-----------------
  try {
    if (update?.callback_query?.data && supabase) {
      const cq = update.callback_query;
      const data = cq.data || '';
      const m = data.match(/^(pay|rej):(\d+)$/);

      // Мгновенно убираем «часики» у кнопки
      await runQuickly(
        fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cq.id, text: '⏳ Обрабатываю...' }),
        }),
        800
      );

      if (!m) return;

      const [, action, idStr] = m;
      const reqId = Number(idStr);

      // Основная работа — отдельно, чтобы не блокировать webhook-ответ
      (async () => {
        try {
          const { data: pr } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('id', reqId)
            .maybeSingle();

          if (!pr) {
            await runQuickly(
              fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: cq.id, text: 'Заявка не найдена' }),
              }),
              800
            );
            return;
          }

          if (action === 'pay' && pr.status === 'pending') {
            const needStars = Math.round((pr.amount_rub || 0) * 2);

            // 1) помечаем оплаченной
            await supabase
              .from('payment_requests')
              .update({
                status: 'paid',
                paid_amount_rub: pr.amount_rub,
                paid_at: new Date().toISOString(),
                admin_id: cq.from?.id ?? null,
              })
              .eq('id', reqId);

            // 2) попытка списать баланс
            // 2.1 RPC, если есть
            let debited = false;
            try {
              await supabase.rpc('debit_user_balance', {
                p_user_id: pr.user_id,              // UUID
                p_amount_rub: pr.amount_rub,
                p_amount_stars: needStars,
              });
              debited = true;
            } catch {
              debited = false;
            }
            // 2.2 Fallback — запись в ledger (отрицательная)
            if (!debited) {
              try {
                await supabase.from(LEDGER).insert([
                  {
                    tg_id: pr.tg_id,
                    type: 'sbp_payment',
                    asset_amount: -needStars,        // списываем ⭐
                    amount_rub: -(pr.amount_rub || 0),
                    rate_used: 0.5,
                    status: 'ok',
                    metadata: { payment_request_id: pr.id },
                  },
                ]);
              } catch {}
            }

            // 3) уведомляем пользователя
            if (TG_BOT_TOKEN && pr.tg_id) {
              await runQuickly(
                fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: pr.tg_id,
                    text: `Оплата подтверждена ✅\nСумма: ${pr.amount_rub} ₽ (${needStars} ⭐)`,
                  }),
                }),
                800
              );
            }

            // 4) убираем кнопки у админа
            if (cq.message?.message_id) {
              await runQuickly(
                fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/editMessageReplyMarkup`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: cq.message.chat.id,
                    message_id: cq.message.message_id,
                    reply_markup: { inline_keyboard: [] },
                  }),
                }),
                800
              );
            }

            // финальный ACK
            await runQuickly(
              fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: cq.id, text: '✅ Отмечено как оплачено' }),
              }),
              800
            );
            return;
          }

          if (action === 'rej' && pr.status === 'pending') {
            await supabase
              .from('payment_requests')
              .update({ status: 'rejected', admin_id: cq.from?.id ?? null })
              .eq('id', reqId);

            if (cq.message?.message_id) {
              await runQuickly(
                fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/editMessageReplyMarkup`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: cq.message.chat.id,
                    message_id: cq.message.message_id,
                    reply_markup: { inline_keyboard: [] },
                  }),
                }),
                800
              );
            }

            await runQuickly(
              fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: cq.id, text: '❌ Отклонено' }),
              }),
              800
            );
            return;
          }

          // повторный клик / уже обработано
          await runQuickly(
            fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: cq.id, text: 'Ссылка уже обработана' }),
            }),
            800
          );
        } catch (e) {
          await runQuickly(
            fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: cq.id, text: 'Ошибка обработки' }),
            }),
            800
          );
        }
      })();

      // ветка inline-кнопок обработана
    }
  } catch (e) {
    console.error('callback_query error', e);
  }

  // -----------------[ ПОПОЛНЕНИЯ (как было) ]-----------------
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
        const stars = total;
        const amountRub = stars / 2; // курс 2⭐ = 1₽
        const rate = 0.5;

        // ledger — единственный источник истины, balances_by_tg посчитает сам
        await supabase.from(LEDGER).insert([{
          tg_id: fromId,
          type: 'stars_topup',
          asset_amount: stars,
          amount_rub: amountRub,
          rate_used: rate,
          status: 'ok',
          metadata: sp,
        }]);

        // телеметрия (не обязательно)
        try {
          await supabase.from('webhook_logs').insert([{
            kind: 'successful_payment',
            tg_id: fromId,
            payload: sp
          }]);
        } catch {}

        // уведомление пользователю (не обязательно)
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
    // ответ уже отправлен
  }
}
