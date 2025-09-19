import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // service_role, чтобы RLS не мешала view
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const tg_id_raw = (req.query.tg_id ?? req.body?.tg_id ?? '').toString().trim()
    const tg_id = tg_id_raw ? Number(tg_id_raw) : NaN
    if (!tg_id || Number.isNaN(tg_id)) {
      return res.status(400).json({ ok: false, error: 'BAD_TG_ID' })
    }

    // balances_by_tg: tg_id, stars, ton, total_rub
    const { data, error } = await supabase
      .from('balances_by_tg')
      .select('tg_id, stars, ton, total_rub')
      .eq('tg_id', tg_id)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('my-balance select error', error)
      return res.status(500).json({ ok: false, error: 'DB_ERROR' })
    }

    const zeros = { stars: 0, ton: 0, total_rub: 0 }
    const row = data ?? zeros

    // приведи к числам (numeric приходит строкой)
    const toNum = (v: any) => (v == null ? 0 : Number(v))
    const payload = {
      ok: true,
      tg_id,
      stars: toNum(row.stars),
      ton: toNum(row.ton),
      total_rub: toNum(row.total_rub),
      ts: Date.now()
    }
    return res.status(200).json(payload)
  } catch (e) {
    console.error('my-balance fatal', e)
    return res.status(500).json({ ok: false, error: 'FATAL' })
  }
}
