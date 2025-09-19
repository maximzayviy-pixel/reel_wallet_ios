export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { amount_stars = 0, title = 'Reel Wallet Stars', description = 'Пополнение баланса звёздами', payload = 'stars_topup', tg_id } = req.body || {};
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(400).json({ error: 'No TELEGRAM_BOT_TOKEN' });
  const url = `https://api.telegram.org/bot${token}/createInvoiceLink`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, description, payload,
        currency: 'XTR',
        prices: [{ label: 'Stars', amount: Math.round(Number(amount_stars)||0) }]
      })
    });
    const j = await r.json();
    if (!j.ok) return res.status(400).json({ error: j.description || 'Bot API error' });
    return res.json({ invoice_url: j.result });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
