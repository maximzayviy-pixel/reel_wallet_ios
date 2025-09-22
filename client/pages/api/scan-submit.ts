// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

type Body = {
  tg_id?: number | string;
  qr_payload?: string;
  amount_rub?: number | string;
};

const ok = (res: NextApiResponse, body: any = { ok: true }) =>
  res.status(200).json(body);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const { tg_id, qr_payload, amount_rub } = (req.body || {}) as Body;
  const tgId = Number(tg_id || 0);
  const amountRub = Number(amount_rub || 0);

  // быстрая валидация — это и есть твоя ошибка "tg_id, qr_payload, amount_rub are required"
  if (!tgId || !qr_payload || !amountRub) {
    return ok(res, { ok: false, code: 'BAD_INPUT', error: 'tg_id, qr_payload, amount_rub are required' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return ok(res, { ok: false, code: 'NO_SUPABASE', error: 'supabase config missing' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const TG_BOT_TOKEN  = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT || process.env.ADMIN_TG_ID || '';

  // helper для логов в вебхуки
  const log = async (payload: any) => {
    try { await supabase.from('webhook_logs').insert([{ kind: 'scan-submit', payload }]); } catch {}
  };

  try {
    // 1) доступный баланс
    let available = 0;
    try {
      const { data, error } = await supabase
        .from('balances_by_tg')
        .select('total_rub')
        .eq('tg_id', tgId)
        .maybeSingle();
      if (error) throw error;
      available = Number(data?.total_rub || 0);
    } catch (e) {
      await log({ step: 'read-balance-failed', error: String(e) });
    }

    if (available < amountRub) {
      await log({ step: 'insufficient', tgId, need: amountRub, have: available });
      return ok(res, { ok: false, code: 'INSUFFICIENT_FUNDS', need: amountRub, have: available });
    }

    // 2) QR-изображение (в URL-сервисе)
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(qr_payload)}`;

    // 3) заявка (ВАЖНО: у тебя поле называется image_url)
    const { data: reqRow, error: insErr } = await supabase
      .from('payment_requests')
      .insert([{
        tg_id: tgId,
        qr_payload,
        image_url: qrImageUrl,   // <-- под твоё поле
        amount_rub: amountRub,
        max_limit_rub: amountRub,
        status: 'new'
      }])
      .select('id')
      .maybeSingle();

    if (insErr || !reqRow?.id) {
      await log({ step: 'insert-request-failed', error: insErr?.message, tgId, amountRub });
      return ok(res, { ok: false, code: 'INSERT_REQUEST_FAILED', error: insErr?.message || 'failed_to_insert_request' });
    }

    // 4) резерв в ledger (уменьшит доступный total_rub)
    try {
      await supabase.from('ledger').insert([{
        tg_id: tgId,
        type: 'reserve',
        amount_rub: amountRub,
        rate_used: 1,
        status: 'hold',
        metadata: { payment_request_id: reqRow.id, qr_payload }
      }]);
    } catch (e) {
      await log({ step: 'insert-reserve-failed', error: String(e), tgId, reqId: reqRow.id });
      // не прерываем — пусть заявка хотя бы дойдёт до админа
    }

    // 5) админу (фото, fallback — текст)
    if (TG_BOT_TOKEN && ADMIN_CHAT_ID) {
      const caption =
        `🧾 Новая заявка #${reqRow.id}\n` +
        `👤 Пользователь: ${tgId}\n` +
        `💰 Сумма: ${amountRub} ₽\n\n` +
        `🔗 ${qr_payload}`;

      try {
        const r = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, photo: qrImageUrl, caption })
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.description || 'sendPhoto failed');
      } catch (e) {
        await log({ step: 'sendPhoto-failed', error: String(e) });
        // пробуем текстом
        try {
          await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: caption })
          });
        } catch (e2) {
          await log({ step: 'sendMessage-failed', error: String(e2) });
        }
      }
    } else {
      await log({ step: 'skip-admin', reason: 'no admin chat or token' });
    }

    await log({ step: 'done', id: reqRow.id, tgId, amountRub });
    return ok(res, { ok: true, id: reqRow.id });
  } catch (e: any) {
    await log({ step: 'fatal', error: e?.message || String(e) });
    return ok(res, { ok: false, code: 'INTERNAL', error: e?.message || 'internal_error' });
  }
}
