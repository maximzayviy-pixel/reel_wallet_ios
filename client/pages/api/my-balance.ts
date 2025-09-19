import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { tg_id } = req.body || {};
  if (!tg_id) return res.status(400).json({ error: 'tg_id required' });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  // Find user by tg_id
  const { data: user, error: uerr } = await supabase.from('users').select('id').eq('tg_id', String(tg_id)).single();
  if (uerr || !user) return res.status(404).json({ error: 'user not found' });

  // Fetch balance by user_id
  const { data: bal } = await supabase.from('balances').select('stars, ton').eq('user_id', user.id).single();

  return res.json({ stars: bal?.stars || 0, ton: bal?.ton || 0 });
}
