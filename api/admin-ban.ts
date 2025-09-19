import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { user_id } = req.body;
  const { data, error } = await supabase
    .from('users')
    .update({ is_banned: true })
    .eq('id', user_id)
    .select();

  if (error) return res.status(400).json({ error });
  res.json({ success: true, user: data[0] });
}