// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Функция для прямого обновления баланса
async function updateBalanceDirectly(supabase: any, userId: string, tgId: number) {
  console.log('Updating balance directly for user:', { userId, tgId });
  
  try {
    // Считаем баланс из ledger
    const { data: ledgerData, error: ledgerError } = await supabase
      .from('ledger')
      .select('amount, amount_rub, type')
      .eq('user_id', userId)
      .eq('status', 'done');
    
    if (ledgerError) {
      console.error('Error fetching ledger data:', ledgerError);
      return;
    }
    
    let totalStars = 0;
    let totalTon = 0;
    let totalRub = 0;
    
    ledgerData?.forEach((record: any) => {
      if (record.type?.includes('stars')) {
        totalStars += Number(record.amount || 0);
      } else if (record.type?.includes('ton')) {
        totalTon += Number(record.amount || 0);
      }
      totalRub += Number(record.amount_rub || 0);
    });
    
    console.log('Calculated balance:', { totalStars, totalTon, totalRub });
    
    // Обновляем баланс
    const { error: balanceError } = await supabase
      .from('balances')
      .upsert({
        user_id: userId,
        stars: totalStars,
        ton: totalTon,
        available_rub: totalRub,
        bonus_rub: 0,
        hold_rub: 0
      }, { onConflict: 'user_id' });
    
    if (balanceError) {
      console.error('Error updating balance:', balanceError);
    } else {
      console.log('Balance updated directly:', { totalStars, totalTon, totalRub });
    }
  } catch (e) {
    console.error('Direct balance update error:', e);
  }
}

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

  // мягкий секрет — НЕ прерываем обработку
  const requiredSecret = process.env.TG_WEBHOOK_SECRET;
  const gotSecret = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  if (requiredSecret && gotSecret !== requiredSecret) {
    console.warn('telegram-webhook: secret mismatch', {
      haveEnv: !!requiredSecret,
      gotHeader: !!gotSecret,
    });
  }

  const TG_BOT_TOKEN =
    process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  const LEDGER = process.env.TABLE_LEDGER || 'ledger';
  const REFRESH_BALANCES_RPC = process.env.RPC_REFRESH_BALANCES || ''; // опционально

  const update = (req.body || {}) as TGUpdate;
  console.log('Webhook received update:', { 
    hasCallbackQuery: !!update?.callback_query,
    hasMessage: !!update?.message,
    callbackData: update?.callback_query?.data,
    messageText: update?.message?.text?.substring(0, 100)
  });
  
  const supabase =
    SUPABASE_URL && SUPABASE_SERVICE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
          auth: { persistSession: false },
        })
      : null;

  // ---------- INLINE-КНОПКИ (✅/❌) ----------
  if (update?.callback_query?.data && supabase) {
    const cq = update.callback_query;
    const data = cq.data || '';
    console.log('Received callback query:', { data, from: cq.from?.id, messageId: cq.message?.message_id });
    
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

    if (!m) {
      console.log('No match for callback data:', data);
      return;
    }

    const action = m[1] as 'pay' | 'rej';
    const reqId = m[2]; // строка (UUID или число)
    
    console.log('Processing callback:', { action, reqId });

    // 3) Основная работа — в фоне
    (async () => {
      try {
        console.log('Looking up payment request:', reqId);
        const { data: pr, error: prErr } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('id', reqId)
          .maybeSingle();

        if (prErr) {
          console.log('Database error when looking up payment request:', { reqId, error: prErr });
          await runQuickly(
            fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: cq.id, text: 'Ошибка базы данных' }),
            }),
            800
          );
          return;
        }

        if (!pr) {
          console.log('Payment request not found:', { reqId });
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

        console.log('Payment request found:', { id: pr.id, status: pr.status, amount: pr.amount_rub });
        console.log('Processing action:', action, 'for request:', pr.id);

        if (action === 'pay' && pr.status === 'pending') {
          console.log('Processing payment confirmation...');
          const needStars = Math.round((pr.amount_rub || 0) * 2);
          console.log('Need stars to debit:', needStars);

          // Получаем user_id для ledger
          console.log('Looking up user by tg_id:', pr.tg_id);
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('tg_id', pr.tg_id)
            .single();

          if (userError || !userData) {
            console.log('User not found:', { error: userError, tgId: pr.tg_id });
            await runQuickly(
              fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: cq.id, text: 'Пользователь не найден' }),
              }),
              800
            );
            return;
          }
          
          console.log('User found:', { userId: userData.id, tgId: pr.tg_id });
          console.log('About to update payment request status...');

          // пометить оплаченной
          console.log('Updating payment request status to paid...');
          const { error: statusError } = await supabase
            .from('payment_requests')
            .update({
              status: 'paid',
              paid_amount_rub: pr.amount_rub,
              paid_at: new Date().toISOString(),
              admin_id: cq.from?.id ?? null,
            })
            .eq('id', reqId);

          if (statusError) {
            console.error('Error updating payment request status:', statusError);
          } else {
            console.log('Payment request status updated successfully');
          }

          // гарантированное списание через ledger (минусовые ⭐)
          try {
            console.log('Debiting stars:', { needStars, userId: userData.id, tgId: pr.tg_id });
            console.log('About to insert into ledger...');
            
            const { error: ledgerError } = await supabase.from('ledger').insert([
              {
                user_id: userData.id,
                tg_id: pr.tg_id,
                type: 'stars_spend_payment',
                amount_rub: 0,
                amount: -needStars,
                delta: -needStars,
                asset_amount: -needStars,
                rate_used: 0.5,
                status: 'done',
                metadata: { 
                  source: 'payment_confirmation', 
                  payment_request_id: pr.id,
                  amount_rub: pr.amount_rub
                },
              },
            ]);
            
            if (ledgerError) {
              console.error('Ledger insert error:', ledgerError);
              throw ledgerError;
            }
            
            console.log('Stars debited successfully');
            console.log('Proceeding to balance update...');
            
            // Обновляем баланс пользователя
            try {
              console.log('Calling update_user_balance_by_tg_id for tg_id:', pr.tg_id);
              const { error: balanceError } = await supabase.rpc('update_user_balance_by_tg_id', { p_tg_id: pr.tg_id });
              
              if (balanceError) {
                console.error('Balance update failed:', balanceError);
                // Попробуем альтернативный способ - прямое обновление баланса
                console.log('Trying direct balance update...');
                await updateBalanceDirectly(supabase, userData.id, pr.tg_id);
              } else {
                console.log('Balance updated successfully for user:', pr.tg_id);
              }
            } catch (balanceError) {
              console.error('Balance update exception:', balanceError);
              // Попробуем прямое обновление как fallback
              try {
                console.log('Trying direct balance update as fallback...');
                await updateBalanceDirectly(supabase, userData.id, pr.tg_id);
              } catch (e) {
                console.error('Direct balance update also failed:', e);
              }
            }
          } catch (e) {
            console.error('ledger debit failed', e);
            // Откатываем статус запроса
            await supabase
              .from('payment_requests')
              .update({ status: 'pending', admin_id: null, paid_at: null })
              .eq('id', reqId);
            
            await runQuickly(
              fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: cq.id, text: 'Ошибка списания баланса' }),
              }),
              800
            );
            return;
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
        } else if (action === 'rej' && pr.status === 'pending') {
          console.log('Processing payment rejection...');
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
        } else {
          console.log('Request already processed or invalid action:', { 
            action, 
            status: pr.status, 
            reqId 
          });
          
          // повторный клик / уже обработано
          await runQuickly(
            fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                callback_query_id: cq.id, 
                text: `Запрос уже обработан (статус: ${pr.status})` 
              }),
            }),
            800
          );
        }
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
      const currency = sp.currency;               // обычно 'XTR'
      const total = Number(sp.total_amount || 0); // для Stars — это кол-во звёзд
      if (fromId && currency === 'XTR' && total > 0) {
        console.log('Successful payment received:', { fromId, stars: total });
        
        const stars = total;
        const amountRub = stars / 2;  // курс 2⭐ = 1₽
        const rate = 0.5;

        // Получаем user_id
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('tg_id', fromId)
          .single();

        if (userError || !userData) {
          console.error('User not found for topup:', { fromId, error: userError });
          // Пытаемся создать пользователя
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({ tg_id: fromId, role: 'user' })
            .select('id')
            .single();
          
          if (createError || !newUser) {
            console.error('Failed to create user for topup:', createError);
            return;
          }
          userData.id = newUser.id;
        }

        console.log('Inserting topup into ledger:', { userId: userData.id, stars });

        const { error: ledgerError } = await supabase.from('ledger').insert([{
          user_id: userData.id,
          tg_id: fromId,
          type: 'stars_topup',
          amount: stars,
          delta: stars,
          asset_amount: stars,
          amount_rub: amountRub,
          rate_used: rate,
          status: 'done',
          metadata: sp,
        }]);

        if (ledgerError) {
          console.error('Error inserting topup into ledger:', ledgerError);
          return;
        }

        console.log('Topup inserted successfully');

        // Обновляем баланс
        try {
          await supabase.rpc('update_user_balance_by_tg_id', { p_tg_id: fromId });
          console.log('Balance updated after topup');
        } catch (balanceError) {
          console.error('Balance update failed after topup:', balanceError);
          // Fallback на прямое обновление
          try {
            await updateBalanceDirectly(supabase, userData.id, fromId);
            console.log('Balance updated directly after topup');
          } catch (e) {
            console.error('Direct balance update also failed:', e);
          }
        }

        try {
          await supabase.from('webhook_logs').insert([{
            kind: 'successful_payment',
            tg_id: fromId,
            payload: sp
          }]);
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
