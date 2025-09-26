import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './admin/_guard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const admin = await requireAdmin(req, res);
  if (!admin) return; // 403 already sent
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