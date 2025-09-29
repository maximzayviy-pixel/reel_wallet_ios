
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './_guard';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const q = String(req.query.q || '');
  const limit = Math.min(parseInt(String(req.query.limit||'50'),10), 200);
  const { data, error } = await supabase
    .from('users')
    .select('id, tg_id, username, role, is_verified, is_banned, created_at')
    .ilike('username', q ? `%${q}%` : '%')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return res.status(400).json({ error });
  res.json({ ok: true, rows: data });
}
