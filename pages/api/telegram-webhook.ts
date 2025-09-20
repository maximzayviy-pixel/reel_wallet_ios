// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

/**
 * Telegram webhook (Stars payments).
 * Handles successful_payment and increments balances.
 *
 * Set webhook to:
 *   https://<domain>/api/telegram-webhook
 *
 * ENV:
 *  - TG_BOT_TOKEN
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_KEY
 *  - TABLE_BALANCES (optional, default: 'balances')
 *  - TABLE_LEDGER   (optional, default: 'ledger')
 */
export const config = { api: { bodyParser: true } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const update = req.body

    const url = process.env.SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_KEY!
    if (!url || !key) return res.status(200).json({ ok: true })

    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const balancesTable = process.env.TABLE_BALANCES || 'balances'
    const ledgerTable   = process.env.TABLE_LEDGER || 'ledger'

    // If this is a message with successful_payment -> credit stars
    const msg = update?.message || update?.edited_message
    if (msg?.successful_payment) {
      const userId = String(msg?.from?.id || '')
      // For Stars (XTR) Telegram returns total_amount == stars count
      const starsAmount = Number(msg?.successful_payment?.total_amount || 0)
      if (userId && starsAmount > 0) {

        const { data: existing } = await supabase
          .from(balancesTable)
          .select('*')
          .eq('tg_id', userId)
          .maybeSingle()

        if (existing) {
          await supabase
            .from(balancesTable)
            .update({ stars: (Number(existing.stars||0) + starsAmount) })
            .eq('tg_id', userId)
        } else {
          await supabase
            .from(balancesTable)
            .insert([{ tg_id: userId, stars: starsAmount, ton: 0 }])
        }

        await supabase.from(ledgerTable).insert([{
          tg_id: userId,
          type: 'stars_topup',
          amount: starsAmount,
          meta: { raw: msg.successful_payment }
        }])
      }
    }

    return res.status(200).json({ ok: true })
  } catch (e: any) {
    console.error('webhook error', e?.message || e)
    return res.status(200).json({ ok: true })
  }
}
