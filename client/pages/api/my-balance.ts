import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string, // server-only!
  { auth: { persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const tgId = Number((req.query.tg_id ?? '').toString().trim());
    if (!tgId || !Number.isFinite(tgId)) {
      return res.status(400).json({ error: 'tg_id is required' });
    }

    const { data, error } = await supabase
      .from('balances_by_tg')
      .select('stars, ton, total_rub')
      .eq('tg_id', tgId)
      .maybeSingle(); // вернёт null если нет строки

    if (error) throw error;

    const stars = Number(data?.stars ?? 0);
    const ton = Number(data?.ton ?? 0);
    const total_rub = Number(data?.total_rub ?? (stars / 2 + ton * 300));

    return res.status(200).json({ stars, ton, total_rub });
  } catch (e:any) {
    console.error('my-balance error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}
