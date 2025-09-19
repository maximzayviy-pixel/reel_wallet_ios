import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { tg_id, username, first_name, last_name } = req.body || {};
  if (!tg_id) return res.status(400).json({ error: 'tg_id required' });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  // upsert user by tg_id
  const { data: user, error } = await supabase
    .from('users')
    .upsert({ tg_id, username, first_name, last_name }, { onConflict: 'tg_id' })
    .select()
    .single();
  if (error) return res.status(400).json({ error });

  // ensure balance row
  await supabase.from('balances').upsert({ user_id: user.id }).select();

  return res.json({ success: true, user });
}
