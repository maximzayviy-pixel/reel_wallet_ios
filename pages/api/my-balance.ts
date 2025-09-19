import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(url, key);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const tg_id = (req.query.tg_id as string) || (req.body && req.body.tg_id);
    if (!tg_id) return res.status(400).json({ error: 'tg_id required' });

    // Try view balances_by_tg first
    let { data, error } = await supabase
      .from('balances_by_tg')
      .select('stars, ton, total_rub')
      .eq('tg_id', tg_id)
      .maybeSingle();

    if (!data) {
      // Fallback join (users -> balances)
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('tg_id', tg_id)
        .maybeSingle();

      if (!user) return res.status(404).json({ error: 'user_not_found' });

      const { data: bal } = await supabase
        .from('balances')
        .select('stars, ton')
        .eq('user_id', user.id)
        .maybeSingle();

      const stars = Number(bal?.stars || 0);
      const ton = Number(bal?.ton || 0);
      const total_rub = stars / 2 + ton * 300;
      return res.status(200).json({ stars, ton, total_rub });
    }

    return res.status(200).json({
      stars: Number((data as any)?.stars || 0),
      ton: Number((data as any)?.ton || 0),
      total_rub: Number((data as any)?.total_rub || 0),
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'internal', details: String(e?.message || e) });
  }
}