// api/stars-invoice-bot.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

function getTgId(req: VercelRequest) {
  let tg_id = (req.method === 'GET' ? req.query.tg_id : req.body?.tg_id) as string | undefined;
  if (!tg_id) {
    const h = (req.headers['x-telegram-init-data'] as string) || '';
    try {
      const p = new URLSearchParams(h);
      const userRaw = p.get('user');
      const u = userRaw ? JSON.parse(userRaw) : null;
      tg_id = u?.id ? String(u.id) : undefined;
    } catch {}
  }
  return tg_id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

  const tg_id = getTgId(req);
  const amount_stars = Number((req.method === 'GET' ? req.query.amount_stars : req.body?.amount_stars) || 0);
  const business_connection_id =
    (req.method === 'GET' ? req.query.business_connection_id : req.body?.business_connection_id) as string | undefined;

  if (!tg_id || !amount_stars) return res.status(400).json({ error: 'tg_id or amount_stars missing' });

  const payload: any = {
    title: 'Reel Wallet пополнение',
    description: 'Оплата звёздами',
    currency: 'XTR',
    prices: [{ label: 'Stars', amount: amount_stars }],
    payload: JSON.stringify({ tg_id, ts: Date.now() }),
    provider_token: '', // для Stars всегда пусто
  };
  if (business_connection_id) payload.business_connection_id = business_connection_id;

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const r = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j: any = await r.json();

  if (!j.ok) return res.status(400).json({ error: j.description || 'Bot API error', raw: j });

  const link = j.result as string;

  // параллельно шлём кнопку в ЛС пользователю
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tg_id,
        text: 'Оплата звёздами — нажми кнопку ниже',
        reply_markup: { inline_keyboard: [[{ text: 'Оплатить ⭐', url: link }]] },
      }),
    });
  } catch {}

  return res.json({ ok: true, link, sent: true });
}
