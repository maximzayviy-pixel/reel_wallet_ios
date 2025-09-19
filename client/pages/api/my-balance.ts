import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

function getTgId(req: NextApiRequest): string | null {
  const h = (req.headers['x-telegram-init-data'] as string) || '';
  try {
    const p = new URLSearchParams(h);
    const u = p.get('user');
    const obj = u ? JSON.parse(u) : null;
    return obj?.id ? String(obj.id) : null;
  } catch { return null; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const tgId = getTgId(req) || (req.query.tg_id as string) || null;
  if (!tgId) return res.status(400).json({ error: 'no tg_id', hint: 'pass x-telegram-init-data header from Mini App or ?tg_id=' });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  // Try view first
  const { data, error } = await supabase.from('balances_by_tg').select('*').eq('tg_id', tgId).maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (data) return res.json({ stars: Number(data.stars||0), ton: Number(data.ton||0), total_rub: Number(data.total_rub||0) });

  // Fallback: join users+balances
  const { data: u } = await supabase.from('users').select('id').eq('tg_id', tgId).single();
  if (!u?.id) return res.json({ stars: 0, ton: 0, total_rub: 0 });
  const { data: b } = await supabase.from('balances').select('stars,ton').eq('user_id', u.id).single();
  const stars = Number(b?.stars||0); const ton = Number(b?.ton||0);
  return res.json({ stars, ton, total_rub: stars/2 + ton*300 });
}
