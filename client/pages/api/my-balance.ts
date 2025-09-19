import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/my-balance?tg_id=123
 * Reads the balances_by_tg view and returns the user totals.
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  const tg_id = req.query.tg_id?.toString()
  if (!tg_id) return res.status(400).json({ error: 'tg_id is required' })

  const { data, error } = await supabase
    .from('balances_by_tg')
    .select('*')
    .eq('tg_id', tg_id)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'not found' })

  return res.status(200).json(data)
}
