import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // именно сервисный ключ
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { tg_id, qr_payload, amount_rub, max_limit_rub, image_url } = req.body || {};
    if (!tg_id || !qr_payload || !amount_rub) {
      return res.status(400).json({ error: 'tg_id, qr_payload, amount_rub are required' });
    }

    // 1) Находим/создаём юзера по tg_id
    const { data: userRow, error: findErr } = await supabase
      .from('users')
      .select('id')
      .eq('tg_id', tg_id)
      .maybeSingle();

    let user_id: string | null = userRow?.id ?? null;

    if (!user_id) {
      // создаём "пустого" пользователя (минимум tg_id). Можно сюда передать username из initData.
      const { data: created, error: insErr } = await supabase
        .from('users')
        .insert([{ tg_id }])
        .select('id')
        .single();

      if (insErr || !created) {
        return res.status(500).json({ error: 'failed_to_upsert_user', details: insErr?.message });
      }
      user_id = created.id;
    }

    // 2) Вставляем заявку. В user_id — UUID, отдельно можно сохранить tg_id для удобства.
    const insertObj: any = {
      user_id,                    // UUID из таблицы users
      tg_id,                      // удобно иметь и это поле
      qr_payload,
      amount_rub: Number(amount_rub),
      max_limit_rub: max_limit_rub ? Number(max_limit_rub) : null,
    };
    if (image_url) insertObj.image_url = image_url; // только если колонка есть

    const { data: reqRow, error: reqErr } = await supabase
      .from('payment_requests')
      .insert([insertObj])
      .select('*')
      .single();

    if (reqErr) {
      return res.status(500).json({ error: 'insert_failed', details: reqErr.message });
    }

    // 3) (Опционально) Пинганём админа в ТГ
    if (process.env.BOT_TOKEN && process.env.ADMIN_TG_ID) {
      fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.ADMIN_TG_ID,
          text:
            `🧾 Новая заявка\n` +
            `TG: ${tg_id}\n` +
            `Сумма: ${amount_rub} ₽\n` +
            `Payload: ${qr_payload.slice(0, 120)}…`,
        }),
      }).catch(()=>{});
    }

    return res.json({ ok: true, id: reqRow.id });
  } catch (e: any) {
    return res.status(500).json({ error: 'unhandled', details: e?.message });
  }
}
