// client/pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type BodyIn = {
  tg_id?: number | string;
  qr_payload?: string;
  amount_rub?: number | string | null;
};

function parseBody(req: NextApiRequest): BodyIn {
  // next/pages/api обычно уже парсит JSON → req.body=object
  if (req.body && typeof req.body === 'object') return req.body as BodyIn;

  // если прилетела строка (text/plain)
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { /* no-op */ }
    // попробуем как form-urlencoded
    try {
      const sp = new URLSearchParams(req.body);
      return {
        tg_id: sp.get('tg_id') || undefined,
        qr_payload: sp.get('qr_payload') || undefined,
        amount_rub: sp.get('amount_rub') || undefined,
      };
    } catch { /* no-op */ }
  }
  return {};
}

function amountFromQr(qr?: string): number | null {
  if (!qr) return null;
  try {
    // большинство QR от НСПК/банков — это URL с параметрами sum/amount в КОПЕЙКАХ
    // примеры:
    // ...?sum=10700&cur=RUB
    // ...?amount=12345
    const u = new URL(qr);
    const raw = u.searchParams.get('sum') ?? u.searchParams.get('amount');
    if (!raw) return null;
    const kop = Number(raw);
    if (!Number.isFinite(kop)) return null;
    return Math.round(kop / 100); // → рубли
  } catch {
    // иногда payload — не URL, попробуем простым парсером
    const m = qr.match(/[?&](?:sum|amount)=(\d+)/i);
    if (!m) return null;
    const kop = Number(m[1]);
    return Number.isFinite(kop) ? Math.round(kop / 100) : null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = parseBody(req);
    const tg_id = body.tg_id ? Number(body.tg_id) : NaN;
    const qr_payload = (body.qr_payload ?? '').toString().trim();
    let amount_rub =
      body.amount_rub == null || body.amount_rub === ''
        ? null
        : Number(body.amount_rub);

    if (amount_rub == null || !Number.isFinite(amount_rub)) {
      amount_rub = amountFromQr(qr_payload);
    }

    if (!Number.isFinite(tg_id) || !qr_payload || amount_rub == null) {
      return res.status(400).json({
        ok: false,
        error: 'tg_id, qr_payload, amount_rub are required',
        got: { tg_id: body.tg_id, has_qr: Boolean(qr_payload), amount_rub },
      });
    }

    // TODO: здесь твоя логика записи в payment_requests
    // const id = await createPaymentRequest({ tg_id, qr_payload, amount_rub });

    return res.status(200).json({ ok: true /*, id*/ });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'Internal error' });
  }
}
