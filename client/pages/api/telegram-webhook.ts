// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const update = req.body;

    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_KEY!;
    if (!url || !key) return res.status(200).json({ ok: true });

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const msg = update?.message || update?.edited_message;
    const sp = msg?.successful_payment;

    if (sp) {
      const fromId = Number(msg?.from?.id || 0);
      const stars = Number(sp?.total_amount || 0); // у Stars total_amount == количеству звёзд

      // телеметрия (необязательно)
      try {
        await supabase.from('webhook_logs').insert([
          { kind: 'successful_payment', tg_id: fromId || null, payload: sp }
        ]);
      } catch { /* пусто */ }

      if (fromId && stars > 0) {
        // Записываем движение пополнения в ledger
        await supabase.from('ledger').insert([
          { tg_id: fromId, kind: 'stars_topup', amount: stars, meta: sp }
        ]);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    // отвечаем 200, чтобы Telegram не ретраил, но пишем в лог
    console.error('webhook error:', e?.message || e);
    return res.status(200).json({ ok: true });
  }
}
