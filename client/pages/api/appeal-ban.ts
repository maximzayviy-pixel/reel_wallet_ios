import { createClient } from '@supabase/supabase-js';

/**
 * Allows a banned user to submit an appeal. Accepts POST body with
 * user_id (uuid) or tg_id (number), and appeal (string). Sets ban_appeal
 * and updates ban_status to 'pending'.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { user_id, tg_id, appeal } = req.body || {};
  if (!appeal || !appeal.trim()) return res.status(400).json({ error: 'appeal message is required' });
  // Determine user id by either user_id or tg_id
  let uid = user_id;
  if (!uid && tg_id) {
    const { data: usr, error } = await supabase.from('users').select('id').eq('tg_id', tg_id).maybeSingle();
    if (error || !usr?.id) return res.status(400).json({ error: 'User not found' });
    uid = usr.id;
  }
  if (!uid) return res.status(400).json({ error: 'user_id or tg_id is required' });
  const { data, error } = await supabase
    .from('users')
    .update({ ban_appeal: String(appeal).trim(), ban_status: 'pending' })
    .eq('id', uid)
    .select();
  if (error) return res.status(400).json({ error });
  res.json({ success: true, user: data?.[0] });
}