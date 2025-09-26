import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from './_auth';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { tgId, user } = await requireUser(req, res);
    const allow = (process.env.ADMIN_TG_IDS || '').split(',').map(s=>s.trim()).filter(Boolean);
    let is_admin = allow.includes(String(tgId));

    if (!is_admin) {
      const { data } = await supabaseAdmin.from('users').select('role').eq('tg_id', String(tgId)).maybeSingle();
      is_admin = data?.role === 'admin';
    }

    res.json({ ok: true, tgId, user, is_admin });
  } catch (e: any) {
    if (!res.headersSent) res.status(401).json({ ok: false, error: e?.message || 'UNAUTHORIZED' });
  }
}
