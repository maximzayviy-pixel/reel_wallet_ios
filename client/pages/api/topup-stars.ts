import type { NextApiRequest, NextApiResponse } from 'next'

const BOT_TOKEN = process.env.TG_BOT_TOKEN!
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || ''
const TG_API = (m: string) => `https://api.telegram.org/bot${BOT_TOKEN}/${m}`

const MIN_STARS = 2
const MAX_STARS = 1_000_000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end()

    const tg_id = Number(req.body?.tg_id)
    const amount_stars = Number(req.body?.amount_stars)

    if (!tg_id || Number.isNaN(tg_id)) {
      return res.status(400).json({ ok: false, error: 'BAD_TG_ID' })
    }
    if (!amount_stars || Number.isNaN(amount_stars) || amount_stars < MIN_STARS || amount_stars > MAX_STARS) {
      return res.status(400).json({ ok: false, error: 'BAD_AMOUNT' })
    }

    // 1) Пытаемся получить ЗВЁЗДНЫЙ инвойс (createStarsInvoiceLink)
    const form = new URLSearchParams({
      title: 'Пополнение Reel Wallet',
      description: 'Оплата Звёздами Telegram',
      payload: JSON.stringify({ kind: 'topup_stars', tg_id }),
      amount: String(amount_stars), // для createStarsInvoiceLink
      currency: 'XTR',              // для обратной совместимости ниже
      prices: JSON.stringify([{ label: 'Reel Wallet', amount: amount_stars }]),
    })

    let link = ''
    let resp = await fetch(TG_API('createStarsInvoiceLink'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    })
    let json: any = await resp.json()

    if (json?.ok && typeof json?.result === 'string' && json.result.startsWith('https://t.me/$')) {
      link = json.result
    } else {
      // 2) Фолбэк на createInvoiceLink (тоже вернёт https://t.me/$slug)
      resp = await fetch(TG_API('createInvoiceLink'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
      })
      json = await resp.json()
      if (json?.ok && typeof json?.result === 'string' && json.result.startsWith('https://t.me/$')) {
        link = json.result
      }
    }

    if (!link) {
      console.error('Invoice failed', json)
      return res.status(500).json({ ok: false, error: 'INVOICE_FAILED' })
    }

    // 3) Сообщение пользователю в ЛС с кнопкой
    await fetch(TG_API('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tg_id,
        text: `Счёт на пополнение: ${amount_stars} ⭐`,
        reply_markup: { inline_keyboard: [[{ text: `Оплатить ${amount_stars}⭐`, url: link }]] }
      })
    }).catch(() => {})

    // 4) Оповещение админа (необязательно)
    if (ADMIN_CHAT_ID) {
      await fetch(TG_API('sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: `🧾 Stars invoice ${amount_stars}⭐ для tg_id=${tg_id}\n${link}`
        })
      }).catch(() => {})
    }

    return res.status(200).json({ ok: true, invoice_link: link })
  } catch (e) {
    console.error('topup-stars fatal', e)
    return res.status(500).json({ ok: false, error: 'FATAL' })
  }
}
