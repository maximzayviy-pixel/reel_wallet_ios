// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const BOT = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_TG_ID = process.env.ADMIN_TG_ID!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    tg_id,
    qr_payload,
    amount_rub,
    max_limit_rub = 0,
    image_url = '',
  } = (req.body ?? {}) as {
    tg_id?: number | string;
    qr_payload?: string;
    amount_rub?: number | string;
    max_limit_rub?: number | string;
    image_url?: string;
  };

  const tgId = Number(tg_id);
  const amountRub = Math.round(Number(amount_rub));
  const maxLimitRub = Math.round(Number(max_limit_rub || 0));

  if (!tgId || !qr_payload || !Number.isFinite(amountRub) || amountRub <= 0) {
    return res.status(400).json({ error: 'tg_id, qr_payload, amount_rub are required' });
  }

  const { data, error } = await supabase
    .from('payment_requests')
    .insert([{
      tg_id: tgId,
      qr_payload,
      amount_rub: amountRub,
      max_limit_rub: Number.isFinite(maxLimitRub) ? maxLimitRub : null,
      image_url: image_url || null,
      status: 'pending',
    }])
    .select('id')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  try {
    const text = `🧾 Новая заявка на оплату
Пользователь: ${tgId}
Сумма: ${amountRub} ₽
${image_url ? 'Фото: ' + image_url : ''}
ID заявки: ${data.id}`;

    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_TG_ID, text })
    });

    if (image_url) {
      await fetch(`https://api.telegram.org/bot${BOT}/sendPhoto`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ chat_id: ADMIN_TG_ID, photo: image_url, caption: `QR к заявке ${data.id}` })
      });
    }
  } catch {}

  return res.json({ ok: true, id: data.id });
}
