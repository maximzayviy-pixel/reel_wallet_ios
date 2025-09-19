// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

// Имена переменных — как в твоих Vercel Settings
const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_TG_ID  = process.env.TELEGRAM_ADMIN_CHAT;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type ReqBody = {
  tg_id?: number | string;
  qr_payload?: string;
  amount_rub?: number | string;
  imageUrl?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { tg_id, qr_payload, amount_rub, imageUrl }: ReqBody = req.body || {};

    const tgNum = Number(tg_id);
    const amt   = Number(amount_rub);
    const payload = (qr_payload || '').toString();

    if (!tgNum || !isFinite(tgNum) || !payload || !amt || !isFinite(amt)) {
      return res.status(400).json({ error: 'tg_id, qr_payload, amount_rub are required' });
    }

    // Пишем заявку в БД (image_url – опционально)
    const { data, error } = await supabase
      .from('payment_requests')
      .insert([{
        tg_id: tgNum,
        qr_payload: payload,
        amount_rub: amt,
        image_url: imageUrl || null,
        status: 'pending'
      }])
      .select('id')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Уведомляем админа, если сконфигурированы переменные
    let admin_notified = false;
    let telegram_error: string | undefined;

    if (TG_BOT_TOKEN && ADMIN_TG_ID) {
      try {
        const msg = [
          '🧾 <b>Новая заявка на оплату</b>',
          `ID: <code>${data?.id}</code>`,
          `От: <code>${tgNum}</code>`,
          `Сумма: <b>${amt} ₽</b>`
        ].join('\n');

        const resp = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_TG_ID,
            text: msg,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Открыть админку', url: `https://${req.headers.host}/admin` }]
              ]
            }
          })
        });
        const j = await resp.json();
        admin_notified = j?.ok === true;
        if (!admin_notified) telegram_error = j?.description || 'unknown error';
      } catch (e: any) {
        telegram_error = e?.message || 'fetch failed';
      }
    }

    return res.status(200).json({
      ok: true,
      id: data?.id,
      admin_notified,
      telegram_error
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}
