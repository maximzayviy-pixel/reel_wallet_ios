// pages/api/my-balance.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });

  const tg_id = Number(req.query.tg_id);
  if (!tg_id) return res.status(400).json({ ok: false, error: 'tg_id_required' });

  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from('balances_by_tg')
    .select('*')
    .eq('tg_id', tg_id)
    .maybeSingle();

  if (error) return res.status(500).json({ ok: false, error: error.message });

  return res.status(200).json({
    ok: true,
    tg_id,
    stars: Number(data?.stars || 0),
    ton: Number(data?.ton || 0),
    total_rub: Number(data?.total_rub || 0),
  });
}
