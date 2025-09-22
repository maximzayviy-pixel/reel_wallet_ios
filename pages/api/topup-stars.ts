// pages/api/topup-stars.ts
import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Stars invoice endpoint (Mini App).
 * Expects: { tg_id: number | string, amount_stars: number }
 * Returns: { ok:true, link: string }
 *
 * ENV:
 *  - TG_BOT_TOKEN    — Bot token from @BotFather
 *  - INVOICE_TITLE   — Optional title (default: "Reel Wallet")
 *  - INVOICE_DESC    — Optional description
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const { tg_id, amount_stars } = req.body || {}
    const token = process.env.TG_BOT_TOKEN
    if (!token) return res.status(500).json({ error: 'Missing env TG_BOT_TOKEN' })

    const stars = Number(amount_stars)
    if (!tg_id || !stars || stars <= 0) {
      return res.status(400).json({ error: 'tg_id and positive amount_stars are required' })
    }

    // Telegram Stars use currency "XTR"
    // The "amount" is in stars * 1 (no cents concept). Integer only.
    const payload = JSON.stringify({ tg_id: String(tg_id), ts: Date.now() })

    const body = {
      title: process.env.INVOICE_TITLE || 'Reel Wallet: пополнение',
      description: process.env.INVOICE_DESC || `Пополнение баланса на ${stars}⭐`,
      currency: 'XTR',
      prices: [{ label: '⭐', amount: stars }],
      payload,
    }

    const resp = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await resp.json()
    if (!resp.ok || !data?.result) {
      return res.status(500).json({ error: 'INVOICE_FAILED', details: data })
    }

    return res.status(200).json({ ok: true, link: data.result })
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e) })
  }
}
