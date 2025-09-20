import type { NextApiRequest, NextApiResponse } from 'next';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT || process.env.TG_BOT_TOKEN;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    if (!BOT_TOKEN) {
      return res.status(500).json({ ok: false, error: 'No BOT TOKEN in env (TELEGRAM_BOT_TOKEN)' });
    }

    const { amount_stars, tg_id, business_connection_id } = req.body || {};
    const stars = Number(amount_stars);

    if (!Number.isFinite(stars) || stars <= 0) {
      return res.status(400).json({ ok: false, error: 'amount_stars required' });
    }

    const payload = `stars_topup:${tg_id || ''}:${Date.now()}:${stars}`;

    const body = new URLSearchParams({
      title: 'Пополнение Reel Wallet',
      description: `Пополнение баланса на ${stars} ⭐`,
      payload,
      currency: 'XTR',
      prices: JSON.stringify([{ label: '⭐', amount: stars }]),
    });

    if (business_connection_id) {
      body.set('business_connection_id', String(business_connection_id));
    }

    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const j = await r.json().catch(() => ({} as any));

    if (!j?.ok || !j?.result) {
      return res.status(400).json({ ok: false, error: j?.description || 'INVOICE_FAILED' });
    }

    return res.status(200).json({ ok: true, link: j.result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Internal error' });
  }
}
