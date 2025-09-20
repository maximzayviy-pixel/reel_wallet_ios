// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const update = req.body;

    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_KEY!; // service role key
    if (!url || !key) {
      // чтобы телеграм не ретраил бесконечно — отвечаем 200
      return res.status(200).json({ ok: true });
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Только успешная оплата звёздами
    const msg = update?.message || update?.edited_message;
    const sp  = msg?.successful_payment;

    if (sp) {
      const fromId = Number(msg?.from?.id || 0);
      // total_amount для XTR == количеству звёзд
      const stars  = Number(sp?.total_amount || 0);

      // Пересчёт в рубли исходя из твоего курса 2 ⭐ = 1 ₽
      const rate = 0.5;
      const amountRub = stars * rate;

      if (fromId && stars > 0) {
        // Пишем в ledger одну запись «пополнение звёзд»
        // Таблица public.ledger имеет поля (как у тебя): 
        // user_id uuid (можно null), tg_id bigint, type text, asset_amount numeric,
        // amount_rub numeric, rate_used numeric, status text, metadata jsonb, created_at timestamptz
        await supabase.from('ledger').insert([{
          user_id: null,
          tg_id: fromId,
          type: 'stars_topup',
          asset_amount: stars,
          amount_rub: amountRub,
          rate_used: rate,
          status: 'done',
          metadata: sp,               // пишем «сырой» успешный платёж для истории
          created_at: new Date().toISOString()
        }]);

        // (не обязательно) простая телеметрия — если есть таблица
        try { await supabase.from('webhook_logs').insert([{ kind: 'successful_payment', tg_id: fromId, payload: sp }]); } catch {}
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    // чтобы TG не слал ретраи — всё равно 200
    console.error('telegram-webhook error:', e);
    return res.status(200).json({ ok: true });
  }
}
