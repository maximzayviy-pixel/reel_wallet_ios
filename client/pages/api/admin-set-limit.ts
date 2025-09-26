import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './_adminAuth';

/**
 * API route to update a user's wallet restrictions and limits. Accepts
 * a POST body with user_id, wallet_limit (number | null) and
 * wallet_restricted (boolean). All values are optional but at least one
 * of wallet_limit or wallet_restricted should be provided.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  // Changing limits is an admin operation
  if (!requireAdmin(req, res)) return;
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { user_id, wallet_limit, wallet_restricted } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  // Prepare update object
  const update: any = {};
  if (wallet_limit !== undefined) update.wallet_limit = wallet_limit === null || wallet_limit === '' ? null : Number(wallet_limit);
  if (wallet_restricted !== undefined) update.wallet_restricted = !!wallet_restricted;
  if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Nothing to update' });
  const { data, error } = await supabase
    .from('users')
    .update(update)
    .eq('id', user_id)
    .select();
  if (error) return res.status(400).json({ error });
  res.json({ success: true, user: data?.[0] });
}