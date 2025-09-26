import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdmin } from '../_auth';

/**
 * POST /api/secure/adjust-balance
 * Body: { tg_id?: string|number, user_uuid?: string, delta_rub: number, reason: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'METHOD_NOT_ALLOWED' });
  try {
    await requireAdmin(req, res, supabaseAdmin);
    const { tg_id, user_uuid, delta_rub, reason } = req.body || {};
    if (!Number.isInteger(delta_rub) || !reason) return res.status(400).json({ ok:false, error:'BAD_INPUT' });

    let userId: string | null = null;
    if (user_uuid) userId = user_uuid;
    if (!userId && tg_id != null) {
      const { data } = await supabaseAdmin.from('users').select('id').eq('tg_id', String(tg_id)).maybeSingle();
      userId = data?.id || null;
    }
    if (!userId) return res.status(404).json({ ok:false, error:'USER_NOT_FOUND' });

    // Prefer secure function (ledger + balance)
    const { error } = await supabaseAdmin.rpc('adjust_balance', { p_user: userId, p_delta: delta_rub, p_reason: reason });
    if (error) return res.status(500).json({ ok:false, error: error.message });

    res.json({ ok:true });
  } catch (e: any) {
    if (!res.headersSent) res.status(401).json({ ok:false, error: e?.message || 'UNAUTHORIZED' });
  }
}
