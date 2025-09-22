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
  if (req.method === 'GET') return ok(res, { ok: true });
  if (req.method !== 'POST') return ok(res);

  // мягкий секрет — НЕ прерываем обработку
  const requiredSecret = process.env.TG_WEBHOOK_SECRET;
  const gotSecret = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  if (requiredSecret && gotSecret !== requiredSecret) {
    console.warn('telegram-webhook: secret mismatch', {
      haveEnv: !!requiredSecret,
      gotHeader: !!gotSecret,
    });
  }

  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const LEDGER = process.env.TABLE_LEDGER || 'ledger';
  const REFRESH_BALANCES_RPC = process.env.RPC_REFRESH_BALANCES || ''; // опционально

  const update = (req.body || {}) as TGUpdate;
  const supabase =
    SUPABASE_URL && SUPABASE_SERVICE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
      : null;

  // ---------- INLINE-КНОПКИ (✅/❌) ----------
  if (update?.callback_query?.data && supabase) {
    const cq = update.callback_query;
    const data = cq.data || '';
    // поддерживаем UUID и числа
    const m = data.match(/^(pay|rej):([A-Za-z0-9-]+)$/);

    // 1) Сразу снимаем «часики» — синхронно
    try {
      await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cq.id, text: '⏳ Обрабатываю...' }),
      });
    } catch (e) {
      console.error('answerCallbackQuery (start) failed', e);
    }

    // 2) Быстрый HTTP-ответ и выходим из хэндлера
    ok(res);

    if (!m) return;

    const action = m[1] as 'pay' | 'rej';
    const reqId = m[2]; // строка (UUID или число)

    // 3) Основная работа — в фоне
    (async () => {
      try {
        const { data: pr, error: prErr } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('id', reqId)
          .maybeSingle();

        if (prErr || !pr) {
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

        if (action === 'pay') {
          const needStars = Math.round((pr.amount_rub || 0) * 2);

          // пометить оплаченной — атомарно только если была pending/new
          const { data: doneRow, error: updErr } = await supabase
            .from('payment_requests')
            .update({
              status: 'paid',
              paid_amount_rub: pr.amount_rub,
              paid_at: new Date().toISOString(),
              admin_id: cq.from?.id ?? null,
            })
            .eq('id', reqId)
            .in('status', ['pending', 'new'])
            .select('*')
            .maybeSingle();

          if (updErr) console.error('payment_requests update error', updErr);

          if (!doneRow) {
            // повторный клик / уже обработана
            await runQuickly(
              fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: cq.id, text: 'Ссылка уже обработана' }),
              }),
              800
            );
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
            return;
          }

          // гарантированное списание через ledger (минусовые ⭐)
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
          } catch (e: any) {
            if (e?.code !== '23505') console.error('ledger debit failed', e);
          }

          // опц.: рефреш materialized view
          if (REFRESH_BALANCES_RPC) {
            try {
              await supabase.rpc(REFRESH_BALANCES_RPC as any);
            } catch {}
          }

          // уведомить пользователя
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

          // убрать клавиатуру у админа
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

        if (action === 'rej') {
          const { data: rejRow } = await supabase
            .from('payment_requests')
            .update({ status: 'rejected', admin_id: cq.from?.id ?? null })
            .eq('id', reqId)
            .in('status', ['pending', 'new'])
            .select('*')
            .maybeSingle();

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
              body: JSON.stringify({
                callback_query_id: cq.id,
                text: rejRow ? '❌ Отклонено' : 'Ссылка уже обработана',
              }),
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

    // мы уже отправили HTTP-ответ выше
    return;
  }

  // ---------- ПРОЧИЕ АПДЕЙТЫ (успешные платежи Stars) ----------
  ok(res); // быстрый ответ

  try {
    // 1) подтверждение pre_checkout_query
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

    // 2) успешный платёж Stars
    const msg = update.message || update.edited_message;
    const sp = msg?.successful_payment;
    if (sp && supabase) {
      const fromId = Number(msg?.from?.id || 0);
      const currency = sp.currency; // обычно 'XTR'
      const total = Number(sp.total_amount || 0); // для Stars — это кол-во звёзд
      if (fromId && currency === 'XTR' && total > 0) {
        const stars = total;
        const amountRub = stars / 2; // курс 2⭐ = 1₽
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
            {
              kind: 'successful_payment',
              tg_id: fromId,
              payload: sp,
            },
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
