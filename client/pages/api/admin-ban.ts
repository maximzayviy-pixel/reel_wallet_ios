import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './admin/_guard';
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') return res.status(405).end();
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { user_id, reason } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  // When a reason is provided store it and mark ban_status as active
  const updateFields: any = { is_banned: true };
  if (reason) updateFields.ban_reason = String(reason);
  if (reason) updateFields.ban_status = 'active';
  const { data, error } = await supabase
    .from('users')
    .update(updateFields)
    .eq('id', user_id)
    .select();
  if (error) return res.status(400).json({ error });
  res.json({ success: true, user: data?.[0] });
}