import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const BOT = process.env.TG_BOT_TOKEN!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const { id, admin_id, note } = req.body || {}
    if (!id) return res.status(400).json({ error:'id required' })

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession:false } })
    const { data: pr, error: e1 } = await supabase.from('payment_requests').select('*').eq('id', id).maybeSingle()
    if (e1 || !pr) return res.status(404).json({ error:'not found' })

    // списание у пользователя: уменьшаем общий рублёвый баланс (ton*300 + stars/2) — у тебя логика может отличаться.
    // Здесь мы просто меняем статус заявки и отправляем уведомление.
    const { error: e2 } = await supabase.from('payment_requests').update({
      status: 'confirmed', admin_id: admin_id || null, admin_note: note || null
    }).eq('id', id)
    if (e2) return res.status(500).json({ error: e2.message })

    // Уведомим пользователя
    if (BOT && pr.tg_id) {
      await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          chat_id: pr.tg_id,
          text: `✅ Оплачено админом по вашей заявке на ${pr.amount_rub}₽.\nСтатус: подтверждено.`
        })
      })
    }

    res.json({ ok:true })
  } catch (e:any) {
    res.status(500).json({ error: e.message })
  }
}
