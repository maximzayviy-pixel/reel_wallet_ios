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

const ok = (res: NextApiResponse, body: any = { ok: true }) =>
  res.status(200).json(body);

const runQuickly = <T,>(p: Promise<T>, ms = 800) =>
  Promise.race([p, new Promise<T | undefined>(r => setTimeout(() => r(undefined as any), ms))]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return ok(res, { ok: true });
  if (req.method !== 'POST') return ok(res);

  // мягкая проверка секрета
  const requiredSecret = process.env.TG_WEBHOOK_SECRET;
  const gotSecret = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  if (requiredSecret && gotSecret !== requiredSecret) {
    console.warn('telegram-webhook: secret mismatch', {
      haveEnv: !!requiredSecret,
      gotHeader: !!gotSecret,
    });
  }

  // мгновенный HTTP-ответ
  ok(res);

  const TG_BOT_TOKEN =
    process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '';
  const LEDGER = process.env.TABLE_LEDGER || 'ledger';

  const update = (req.body || {}) as TGUpdate;
  const supabase =
    SUPABASE_URL && SUPABASE_SERVICE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
          auth: { persistSession: false },
        })
      : null;

  // ----------------- INLINE-КНОПКИ -----------------
  try {
    if (update?.callback_query?.data && supabase) {
      const cq = update.callback_query;
      console.log('CQ in', {
        id: cq.id,
        data: cq.data,
        from: cq.from?.id,
        msg: cq.message?.message_id,
      });

      const data = cq.data || '';
      const m = data.match(/^(pay|rej):(\d+)$/);

      // всегда шлём промежуточный ACK
      try {
        const r = await fetch(
          `https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: '⏳ Обрабатываю...',
            }),
          }
        );
        console.log('CQ ack1', await r.json().catch(() => ({})));
      } catch (e) {
        console.error('CQ ack1 error', e);
      }

      if (!m) return;
      const [, action, idStr] = m;
      const reqId = Number(idStr);

      (async () => {
        try {
          const { data: pr } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('id', reqId)
            .maybeSingle();

          if (!pr) {
            const r = await fetch(
              `https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  callback_query_id: cq.id,
                  text: 'Заявка не найдена',
                }),
              }
            );
            console.log('CQ ack-notfound', await r.json().catch(() => ({})));
            return;
          }

          if (action === 'pay' && pr.status === 'pending') {
            const needStars = Math.round((pr.amount_rub || 0) * 2);

            await supabase
              .from('payment_requests')
              .update({
                status: 'paid',
                paid_amount_rub: pr.amount_rub,
                paid_at: new Date().toISOString(),
                admin_id: cq.from?.id ?? null,
              })
              .eq('id', reqId);

            // пробуем RPC, иначе ledger
            let debited = false;
            try {
              await supabase.rpc('debit_user_balance', {
                p_user_id: pr.user_id,
                p_amount_rub: pr.amount_rub,
                p_amount_stars: needStars,
              });
              debited = true;
            } catch {}
            if (!debited) {
              try {
                await supabase.from(LEDGER).insert([
                  {
                    tg_id: pr.tg_id,
                    type: 'sbp_payment',
                    asset_amount: -needStars,
                    amount_rub: -(pr.amount_rub || 0),
                    rate_used: 0.5,
                    status: 'ok',
                    metadata: { payment_request_id: pr.id },
                  },
                ]);
              } catch {}
            }

            if (TG_BOT_TOKEN && pr.tg_id) {
              try {
                const r = await fetch(
                  `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: pr.tg_id,
                      text: `Оплата подтверждена ✅\nСумма: ${pr.amount_rub} ₽ (${needStars} ⭐)`,
                    }),
                  }
                );
                console.log('user notify', await r.json().catch(() => ({})));
              } catch {}
            }

            if (cq.message?.message_id) {
              try {
                const r = await fetch(
                  `https://api.telegram.org/bot${TG_BOT_TOKEN}/editMessageReplyMarkup`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: cq.message.chat.id,
                      message_id: cq.message.message_id,
                      reply_markup: { inline_keyboard: [] },
                    }),
                  }
                );
                console.log('markup removed', await r.json().catch(() => ({})));
              } catch {}
            }

            const r = await fetch(
              `https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  callback_query_id: cq.id,
                  text: '✅ Отмечено как оплачено',
                }),
              }
            );
            console.log('CQ ack2', await r.json().catch(() => ({})));
            return;
          }

          if (action === 'rej' && pr.status === 'pending') {
            await supabase
              .from('payment_requests')
              .update({ status: 'rejected', admin_id: cq.from?.id ?? null })
              .eq('id', reqId);

            if (cq.message?.message_id) {
              try {
                const r = await fetch(
                  `https://api.telegram.org/bot${TG_BOT_TOKEN}/editMessageReplyMarkup`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: cq.message.chat.id,
                      message_id: cq.message.message_id,
                      reply_markup: { inline_keyboard: [] },
                    }),
                  }
                );
                console.log('markup removed', await r.json().catch(() => ({})));
              } catch {}
            }

            const r = await fetch(
              `https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  callback_query_id: cq.id,
                  text: '❌ Отклонено',
                }),
              }
            );
            console.log('CQ ack2', await r.json().catch(() => ({})));
            return;
          }
        } catch (e) {
          console.error('CQ error', e);
        }
      })();
    }
  } catch (e) {
    console.error('callback_query error', e);
  }

  // ----------------- ПОПОЛНЕНИЯ (как было) -----------------
  try {
    if (update.pre_checkout_query && TG_BOT_TOKEN) {
      const pcq = update.pre_checkout_query;
      await runQuickly(
        fetch(
          `https://api.telegram.org/bot${TG_BOT_TOKEN}/answerPreCheckoutQuery`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pre_checkout_query_id: pcq.id, ok: true }),
          }
        )
      );
    }

    const msg = update.message || update.edited_message;
    const sp = msg?.successful_payment;
    if (sp && supabase) {
      const fromId = Number(msg?.from?.id || 0);
      const currency = sp.currency;
      const total = Number(sp.total_amount || 0);
      if (fromId && currency === 'XTR' && total > 0) {
        const stars = total;
        const amountRub = stars / 2;
        const rate = 0.5;

        await supabase.from(LEDGER).insert([
          {
            tg_id: fromId,
            type: 'stars_topup',
            asset_amount: stars,
            amount_rub: amountRub,
            rate_used: rate,
            status: 'ok',
            metadata: sp,
          },
        ]);

        try {
          await supabase.from('webhook_logs').insert([
            { kind: 'successful_payment', tg_id: fromId, payload: sp },
          ]);
        } catch {}

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
  }
}
