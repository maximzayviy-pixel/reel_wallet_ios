import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const tg_id = req.method === 'GET' ? req.query.tg_id : req.body?.tg_id;
  if (!tg_id) return res.status(400).json({ error: 'tg_id required' });
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase.from('users').select('*').eq('tg_id', String(tg_id)).single();
    if (error) return res.status(400).json({ error: error.message || error });
    return res.json({ ok: true, user: data });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message || e });
  }
}
