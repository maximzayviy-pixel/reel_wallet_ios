export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });
  const { tg_id } = req.body || {};
  if(!tg_id) return res.status(400).json({ ok:false, error:'tg_id required' });

  // Prefer bot invoice endpoint if configured
  const starsBotUrl = process.env.STARS_INVOICE_BOT_URL || process.env.NEXT_PUBLIC_STARS_INVOICE_URL || '';
  if(starsBotUrl){
    // attach tg_id if needed
    const url = starsBotUrl.includes('?') ? `${starsBotUrl}&tg_id=${tg_id}` : `${starsBotUrl}?tg_id=${tg_id}`;
    return res.json({ ok:true, link: url });
  }

  // fallback: use STARS_INVOICE_BASE
  const base = process.env.STARS_INVOICE_BASE || process.env.NEXT_PUBLIC_STARS_INVOICE_URL || '';
  if(!base) return res.status(500).json({ ok:false, error:'No invoice URL configured (STARS_INVOICE_BASE)' });

  const link = base.includes('?') ? `${base}&tg_id=${tg_id}` : `${base}?tg_id=${tg_id}`;
  return res.json({ ok:true, link });
}
