// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // сервисный ключ
);

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_TG_ID = process.env.ADMIN_TG_ID;

function parseAmountRub(body: any): number | null {
  // приоритет: amount_rub -> amount -> sum
  // если число выглядит как "копейки" (>= 100 && кратно 1), делим на 100
  const raw = body?.amount_rub ?? body?.amount ?? body?.sum;
  if (raw == null) return null;
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return null;
  // эвристика: если в QR часто приходит 10700 (копейки) => 107 руб
  if (n >= 1000) return Math.round(n) / 100;
  return n;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const b = req.body || {};

    // Нормализация входа
    const tg_id = Number(b.tg_id ?? b.user_id); // принимаем оба
    const qr_payload = String(b.qr_payload ?? b.qr ?? '');
    const image_url = b.image_url ?? b.imageUrl ?? null;

    const amount_rub = parseAmountRub(b);
    const max_limit_rub = b.max_limit_rub != null ? Number(b.max_limit_rub) : null;

    // Валидация
    if (!tg_id) return res.status(400).json({ error: 'tg_id required' });
    if (!qr_payload) return res.status(400).json({ error: 'qr_payload required' });
    if (!amount_rub) return res.status(400).json({ error: 'amount_rub required (in RUB)' });

    // Находим/создаём пользователя по tg_id
    const { data: u, error: uErr } = await supabase
      .from('users')
      .select('id')
      .eq('tg_id', tg_id)
      .maybeSingle();

    let user_id: string | null = u?.id ?? null;

    if (!user_id) {
      const { data: created, error: cErr } = await supabase
        .from('users')
        .insert([{ tg_id }])
        .select('id')
        .single();
      if (cErr || !created) return res.status(500).json({ error: 'failed_to_upsert_user', details: cErr?.message });
      user_id = created.id;
    }

    // Подготовка объекта вставки
    const insertObj: any = {
      user_id,         // UUID (FK на users.id)
      tg_id,           // удобно иметь и tg_id в заявке
      qr_payload,
      amount_rub: Number(amount_rub),
      max_limit_rub: max_limit_rub != null ? Number(max_limit_rub) : null
    };
    if (image_url) insertObj.image_url = String(image_url);

    // Вставка в payment_requests
    const { data: reqRow, error: reqErr } = await supabase
      .from('payment_requests')
      .insert([insertObj])
      .select('*')
      .single();

    if (reqErr) return res.status(500).json({ error: 'insert_failed', details: reqErr.message });

    // Уведомление админу (опционально)
    if (BOT_TOKEN && ADMIN_TG_ID) {
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_TG_ID,
          text:
`🧾 Новая заявка на оплату
TG: ${tg_id}
Сумма: ${amount_rub} ₽
ID заявки: ${reqRow.id}`
        })
      }).catch(()=>{});
    }

    return res.status(200).json({ ok: true, id: reqRow.id });
  } catch (e: any) {
    return res.status(500).json({ error: 'unhandled', details: e?.message || String(e) });
  }
}
