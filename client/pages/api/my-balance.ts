import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!  // server-only
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const tgId = req.query.tg_id as string | undefined;
    if (!tgId) return res.status(400).json({ error: 'tg_id required' });

    const { data, error } = await supabase
      .from('balances_by_tg')
      .select('tg_id, stars, ton, total_rub')
      .eq('tg_id', tgId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json(
      data ?? { tg_id: Number(tgId), stars: 0, ton: 0, total_rub: 0 }
    );
  } catch (e:any) {
    return res.status(500).json({ error: e.message ?? 'internal' });
  }
}
