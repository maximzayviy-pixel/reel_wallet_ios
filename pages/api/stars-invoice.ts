export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { amount_stars = 0, tg_id } = req.body || {};

  // Prefer a pre-configured link base where backend can validate amount server-side
  const base = process.env.STARS_INVOICE_BASE || process.env.NEXT_PUBLIC_STARS_INVOICE_URL || '';
  if (!base) return res.status(400).json({ error: 'No Stars invoice URL configured. Set STARS_INVOICE_BASE or NEXT_PUBLIC_STARS_INVOICE_URL' });

  // Attach amount as query param if supported by your bot/store
  const url = base.includes('?') ? `${base}&stars=${amount_stars}` : `${base}?stars=${amount_stars}`;
  return res.json({ invoice_url: url });
}
