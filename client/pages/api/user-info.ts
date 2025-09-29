import { createClient } from '@supabase/supabase-js';

/**
 * Provides information about a user such as ban status, reason, wallet limits
 * and verification flag. Accepts GET with either tg_id (Telegram numeric id)
 * or user_id (uuid) query. Returns a subset of the users table fields.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).end();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { tg_id, user_id } = req.query as { tg_id?: string; user_id?: string };
  if (!tg_id && !user_id) return res.status(400).json({ error: 'tg_id or user_id is required' });
  let query = supabase.from('users').select('*').limit(1);
  if (user_id) query = query.eq('id', user_id);
  else query = query.eq('tg_id', tg_id);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return res.status(400).json({ error: error?.message || 'User not found' });
  const { is_banned, ban_reason, ban_status, ban_appeal, wallet_limit, wallet_restricted, is_verified, role } = data as any;
  res.json({ success: true, info: { is_banned, ban_reason, ban_status, ban_appeal, wallet_limit, wallet_restricted, is_verified, role, id: data.id, tg_id: data.tg_id, username: data.username } });
}