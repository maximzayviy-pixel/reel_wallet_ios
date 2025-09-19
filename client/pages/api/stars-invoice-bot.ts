import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  let { amount_stars = 0, tg_id } = req.body || {};

  // Try to extract tg user id from Mini App initData header (as in your old project)
  const initHeader = req.headers['x-telegram-init-data'] as string | undefined;
  if (!tg_id && initHeader) {
    try {
      const params = new URLSearchParams(initHeader);
      const userRaw = params.get('user');
      const u = userRaw ? JSON.parse(userRaw) : null;
      if (u?.id) tg_id = String(u.id);
    } catch {}
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.INVOICE_SECRET || 'changeme';
  if (!token) return res.status(400).json({ error: 'No TELEGRAM_BOT_TOKEN' });
  const amt = Math.round(Number(amount_stars)||0);
  if (amt < 1 || amt > 1000000) return res.status(400).json({ error: 'Invalid stars amount' });
  if (!tg_id) return res.status(400).json({ error: 'tg_id required' });

  const payload = JSON.stringify({ tg_id, amt, ts: Date.now() });
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const url = `https://api.telegram.org/bot${token}/createInvoiceLink`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Reel Wallet Stars',
        description: 'Пополнение баланса Reel Wallet',
        payload: `${payload}|${sig}`,
        currency: 'XTR',
        prices: [{ label: 'Stars', amount: amt }],
        provider_token: "",
        business_connection_id: (req.body?.business_connection_id || undefined)
      })
    });
    const j = await r.json();
    if (!j.ok) return res.status(400).json({ error: j.description || 'Bot API error', raw: j });
    return res.json({ invoice_url: j.result });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
