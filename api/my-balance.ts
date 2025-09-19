// api/my-balance.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function tgIdFromHeader(req: VercelRequest): string | null {
  const h = (req.headers['x-telegram-init-data'] as string) || '';
  try {
    const p = new URLSearchParams(h);
    const userRaw = p.get('user');
    const u = userRaw ? JSON.parse(userRaw) : null;
    return u?.id ? String(u.id) : null;
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const tg_id = (req.query.tg_id as string) || tgIdFromHeader(req);
  if (!tg_id) return res.status(400).json({ error: 'no tg_id' });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  // Try view balances_by_tg
  const { data, error } = await supabase
    .from('balances_by_tg')
    .select('*')
    .eq('tg_id', tg_id)
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });

  if (data) {
    return res.json({
      stars: Number(data.stars || 0),
      ton: Number(data.ton || 0),
      total_rub: Number(data.total_rub || 0),
    });
  }

  // Fallback: users + balances
  const { data: u } = await supabase.from('users').select('id').eq('tg_id', tg_id).single();
  if (!u?.id) return res.json({ stars: 0, ton: 0, total_rub: 0 });

  const { data: b } = await supabase.from('balances').select('stars,ton').eq('user_id', u.id).single();
  const stars = Number(b?.stars || 0);
  const ton = Number(b?.ton || 0);
  return res.json({ stars, ton, total_rub: stars/2 + ton*300 });
}
