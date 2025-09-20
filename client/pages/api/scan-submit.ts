// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

type Body = {
  tg_id?: number | string;
  qr_payload?: string;        // строка SBP/ссылка оплаты
  amount_rub?: number;        // сумма в рублях
};

const ok = (res: NextApiResponse, body: any = { ok: true }) => res.status(200).json(body);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const { tg_id, qr_payload, amount_rub } = (req.body || {}) as Body;

    const tgId = Number(tg_id || 0);
    const amountRub = Number(amount_rub || 0);
    if (!tgId || !qr_payload || !amountRub) {
      return res.status(200).json({ error: 'tg_id, qr_payload, amount_rub are required' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(200).json({ error: 'supabase config missing' });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

    const TG_BOT_TOKEN   = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
    const ADMIN_CHAT_ID  = process.env.TELEGRAM_ADMIN_CHAT || process.env.ADMIN_TG_ID || '';

    // 1) Проверка достаточности средств (по желанию)
    // Читаем доступный total_rub
    let available = 0;
    try {
      const { data } = await supabase
        .from('balances_by_tg')
        .select('total_rub')
        .eq('tg_id', tgId)
        .maybeSingle();
      available = Number(data?.total_rub || 0);
    } catch {}
    if (available < amountRub) {
      return ok(res, { ok: false, error: 'INSUFFICIENT_FUNDS', need: amountRub, have: available });
    }

    // 2) Сохраняем заявку
    const qrImageUrl =
      `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr_payload)}`;

    const { data: reqRow, error: insErr } = await supabase
      .from('payment_requests')
      .insert([{
        tg_id: tgId,
        qr_payload,
        qr_image_url: qrImageUrl,           // если у таблицы другое поле — поменяй на своё
        amount_rub: amountRub,
        max_limit_rub: amountRub,           // если есть лимит — можно потом менять
        status: 'new'
      }])
      .select('id')
      .maybeSingle();

    if (insErr || !reqRow?.id) {
      return ok(res, { ok: false, error: insErr?.message || 'failed_to_insert_request' });
    }

    // 3) РЕЗЕРВ средств в ledger (уменьшит доступный баланс)
    await supabase.from('ledger').insert([{
      tg_id: tgId,
      type: 'reserve',
      amount_rub: amountRub,
      rate_used: 1,            // т.к. резерв в рублях
      status: 'hold',
      metadata: { payment_request_id: reqRow.id, qr_payload }
    }]);

    // 4) Оповещение админу (фото QR + текст)
    if (TG_BOT_TOKEN && ADMIN_CHAT_ID) {
      const caption =
        `🧾 Новая заявка #${reqRow.id}\n` +
        `👤 Пользователь: ${tgId}\n` +
        `💰 Сумма: ${amountRub} ₽\n\n` +
        `🔗 ${qr_payload}`;

      // сначала пробуем отправить фото
      try {
        await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            photo: qrImageUrl,
            caption
          })
        });
      } catch {
        // если не получилось — просто текст
        await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: caption })
        });
      }
    }

    return ok(res, { ok: true, id: reqRow.id });
  } catch (e: any) {
    console.error('scan-submit error:', e?.message || e);
    return ok(res, { ok: false, error: 'internal_error' });
  }
}
