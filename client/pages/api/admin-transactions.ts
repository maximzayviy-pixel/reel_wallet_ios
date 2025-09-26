import { createClient } from '@supabase/supabase-js';

/**
 * Returns the ledger (transaction) history for a given user. Accepts
 * GET query user_id (uuid) and optional limit (number).
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).end();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const user_id = req.query?.user_id as string | undefined;
  const limit = req.query?.limit ? parseInt(String(req.query.limit), 10) : 50;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  const { data, error } = await supabase
    .from('ledger')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return res.status(400).json({ error });
  res.json({ success: true, transactions: data });
}