import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdmin } from '../_auth';

/**
 * POST /api/secure/create-subscription-task
 * Body: { title: string, url: string, reward_rub: number }
 * Adjust to your real schema/fields.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'METHOD_NOT_ALLOWED' });
  try {
    await requireAdmin(req, res, supabaseAdmin);
    const { title, url, reward_rub } = req.body || {};
    if (!title || !url || !Number.isFinite(reward_rub)) return res.status(400).json({ ok:false, error:'BAD_INPUT' });

    const { data, error } = await supabaseAdmin.from('subscription_tasks').insert({
      title, url, reward_rub
    }).select().maybeSingle();
    if (error) return res.status(500).json({ ok:false, error: error.message });

    res.json({ ok:true, task: data });
  } catch (e: any) {
    if (!res.headersSent) res.status(401).json({ ok:false, error: e?.message || 'UNAUTHORIZED' });
  }
}
