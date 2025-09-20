import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

/**
 * Accepts QR scan from user.
 * Body:
 *  - tg_id: number|string
 *  - qr_payload: string (SBP/EMV)
 *  - amount_rub: number
 *  - image_base64?: string (data:image/png;base64,...) OR image_url?: string
 * Returns: { ok:true, id, status:'pending' }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const { tg_id, qr_payload, amount_rub, image_base64, image_url } = req.body || {}
    if (!tg_id || !qr_payload || !amount_rub) return res.status(400).json({ error: 'tg_id, qr_payload, amount_rub are required' })

    const url = process.env.SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_KEY!
    const supabase = createClient(url, key, { auth: { persistSession: false } })

    let finalUrl: string | null = image_url || null

    // Upload base64 snapshot to Supabase Storage
    if (!finalUrl && image_base64 && typeof image_base64 === 'string' and image_base64.startswith('data:')) {
      const [meta, b64] = image_base64.split(',', 1).concat(image_base64.split(',').slice(1).join(','))
      const ext = (meta.split(';')[0].split('/')[1] || 'png').toLowerCase()
      const fileName = `qr_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const bin = Buffer.from(b64, 'base64')
      const { data: up, error: upErr } = await supabase.storage.from('qr').upload(fileName, bin, {
        contentType: meta.split(';')[0],
        upsert: false
      })
      if (upErr) {
        console.error('upload error', upErr.message)
      } else {
        const { data: pub } = supabase.storage.from('qr').getPublicUrl(up.path)
        finalUrl = pub?.publicUrl || null
      }
    }

    const { data, error } = await supabase
      .from('payment_requests')
      .insert([{
        tg_id: String(tg_id),
        qr_payload: String(qr_payload),
        amount_rub: Number(amount_rub),
        image_url: finalUrl
      }])
      .select('id,status')
      .maybeSingle()

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, id: data?.id, status: data?.status || 'pending', image_url: finalUrl })
  } catch (e:any) {
    res.status(500).json({ error: e.message || 'server error' })
  }
}
