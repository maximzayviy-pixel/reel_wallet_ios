import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const status = String(req.query.status || 'pending')
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession:false } })
  const { data, error } = await supabase
    .from('payment_requests')
    .select('id,tg_id,amount_rub,qr_payload,image_url,status,created_at')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return res.status(500).json({ ok:false, error: error.message })
  res.json({ ok:true, items: data })
}
