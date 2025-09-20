// pages/api/my-balance.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

/**
 * Returns balances by tg_id from the SQL VIEW balances_by_tg
 * Expects:
 *   GET  /api/my-balance?tg_id=...
 *   POST /api/my-balance  { tg_id: ... }
 *
 * ENV:
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_KEY  (service role, for RLS bypass of view if needed)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const tg_id = String((req.method === 'GET' ? req.query.tg_id : req.body?.tg_id) || '').trim()
    if (!tg_id) return res.status(400).json({ error: 'tg_id required' })

    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' })

    const supabase = createClient(url, key, { auth: { persistSession: false } })

    // VIEW with schema: tg_id (text/bigint), stars numeric, ton numeric, total_rub numeric
    const { data, error } = await supabase
      .from('balances_by_tg')
      .select('*')
      .eq('tg_id', tg_id)
      .limit(1)
      .maybeSingle()

    if (error) return res.status(500).json({ error: error.message })
    const result = data || { tg_id, stars: 0, ton: 0, total_rub: 0 }
    return res.status(200).json({ ok: true, ...result })
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e) })
  }
}
