// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const BOT = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_TG_ID = process.env.ADMIN_TG_ID || '';

// Helper: safe JSON parse
function safeParse(x: any) {
  if (x == null) return {};
  if (typeof x === 'object') return x;
  try { return JSON.parse(String(x)); } catch { return {}; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const raw = req.body as any;
  const body = safeParse(raw);

  // Tolerant field mapping (accepts common aliases)
  const tgId = Number(body.tg_id ?? body.user_id ?? body.userId ?? body.tgid ?? body.tgId);
  const qrPayload = String(body.qr_payload ?? body.qr ?? body.payload ?? body.qrPayload ?? '');
  // Accept "amount" in kopecks or rub; prefer amount_rub
  let amtRubRaw: any = body.amount_rub ?? body.amountRub ?? body.sum_rub ?? body.sumRub ?? body.rub;
  if (amtRubRaw == null && body.sum != null) amtRubRaw = body.sum;
  if (amtRubRaw == null && body.amount != null) amtRubRaw = body.amount;

  // normalize amount: strings like "107.00" -> 107; "10700" might be kopecks, try to detect
  let amount_rub = NaN;
  if (typeof amtRubRaw === 'string' && amtRubRaw.includes('.')) {
    amount_rub = Math.round(parseFloat(amtRubRaw));
  } else if (typeof amtRubRaw === 'number') {
    if (amtRubRaw > 100000) {
      // clearly not rub; treat as kopecks
      amount_rub = Math.round(amtRubRaw / 100);
    } else {
      amount_rub = Math.round(amtRubRaw);
    }
  } else if (typeof amtRubRaw === 'string') {
    const n = Number(amtRubRaw);
    if (Number.isFinite(n)) {
      amount_rub = n > 100000 ? Math.round(n/100) : Math.round(n);
    }
  }

  const maxLimitRub = (body.max_limit_rub ?? body.maxLimitRub);
  const max_limit_rub = Number.isFinite(Number(maxLimitRub)) ? Math.round(Number(maxLimitRub)) : null;

  const image_url = body.image_url ?? body.imageUrl ?? null;

  if (!tgId || !qrPayload || !Number.isFinite(amount_rub) || amount_rub <= 0) {
    return res.status(400).json({ error: 'tg_id, qr_payload, amount_rub are required' });
  }

  const { data, error } = await supabase
    .from('payment_requests')
    .insert([{
      tg_id: tgId,
      qr_payload: qrPayload,
      amount_rub: amount_rub,
      max_limit_rub,
      image_url,
      status: 'pending',
    }])
    .select('id')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Optional notify admin
  if (BOT && ADMIN_TG_ID) {
    try {
      const text = `🧾 Новая заявка на оплату
Пользователь: ${tgId}
Сумма: ${amount_rub} ₽
${image_url ? 'Фото: ' + image_url : ''}
ID заявки: ${data.id}`;
      await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ chat_id: ADMIN_TG_ID, text })
      });
      if (image_url) {
        await fetch(`https://api.telegram.org/bot${BOT}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ chat_id: ADMIN_TG_ID, photo: image_url, caption: `QR к заявке ${data.id}` })
        });
      }
    } catch {}
  }

  return res.json({ ok: true, id: data.id });
}
