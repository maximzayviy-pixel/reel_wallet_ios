import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,              // service_role ОБЯЗАТЕЛЕН
  { auth: { persistSession: false } }
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const explain = 'explain' in req.query // ?explain=1 покажет текст ошибки (удобно в проде)
  try {
    const tgRaw = (req.query.tg_id ?? req.body?.tg_id ?? '').toString().trim()
    const tg_id = Number(tgRaw)
    if (!tg_id || Number.isNaN(tg_id)) {
      return res.status(400).json({ ok: false, error: 'BAD_TG_ID' })
    }

    // balances_by_tg ДОЛЖНА содержать: tg_id, stars, ton, total_rub
    const { data, error } = await supabase
      .from('balances_by_tg')
      .select('tg_id, stars, ton, total_rub')
      .eq('tg_id', tg_id)
      .maybeSingle()

    if (error) {
      if (explain) return res.status(500).json({ ok: false, error: 'DB_ERROR', details: error.message })
      return res.status(500).json({ ok: false, error: 'DB_ERROR' })
    }

    const toNum = (v: any) => (v == null ? 0 : Number(v))
    const row = data ?? { stars: 0, ton: 0, total_rub: 0 }

    return res.status(200).json({
      ok: true,
      tg_id,
      stars: toNum(row.stars),
      ton: toNum(row.ton),
      total_rub: toNum(row.total_rub),
      ts: Date.now(),
    })
  } catch (e: any) {
    console.error('my-balance fatal', e)
    if (explain) return res.status(500).json({ ok: false, error: 'FATAL', details: String(e?.message ?? e) })
    return res.status(500).json({ ok: false, error: 'FATAL' })
  }
}
