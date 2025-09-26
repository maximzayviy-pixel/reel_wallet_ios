import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // Only POST requests are allowed
  if (req.method !== 'POST') return res.status(405).end();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  // Reset ban flags and related fields
  const { data, error } = await supabase
    .from('users')
    .update({
      is_banned: false,
      ban_reason: null,
      ban_appeal: null,
      ban_status: null,
    })
    .eq('id', user_id)
    .select();
  if (error) return res.status(400).json({ error });
  res.json({ success: true, user: data?.[0] });
}