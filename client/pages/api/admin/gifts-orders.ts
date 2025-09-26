import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './_guard';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const limit = Math.min(parseInt(String(req.query.limit||'50'),10), 200);
  const offset = Math.max(parseInt(String(req.query.offset||'0'),10), 0);
  const { data, error, count } = await supabase
    .from('gifts_orders')
    .select('id, user_id, gift_id, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return res.status(400).json({ error });
  res.json({ ok: true, rows: data, total: count });
}