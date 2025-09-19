import type { NextApiRequest, NextApiResponse } from 'next'

const BOT_TOKEN = process.env.TG_BOT_TOKEN!
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID! // опционально: куда слать алерты

const TG_API = (m: string) => `https://api.telegram.org/bot${BOT_TOKEN}/${m}`

const STARS_PER_RUB = 2  // 2⭐ = 1₽ (как в UI)
const MIN_STARS = 2
const MAX_STARS = 1_000_000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end()
    const { tg_id, amount_stars } = req.body ?? {}

    const uid = Number(tg_id)
    const stars = Number(amount_stars)

    if (!uid || Number.isNaN(uid)) {
      return res.status(400).json({ ok: false, error: 'BAD_TG_ID' })
    }
    if (!stars || Number.isNaN(stars) || stars < MIN_STARS || stars > MAX_STARS) {
      return res.status(400).json({ ok: false, error: 'BAD_AMOUNT' })
    }

    // 1) создаём invoice link в боте
    // ПРЕДПОЧТИТЕЛЬНО: createStarsInvoiceLink (когда доступно)
    // Падение на этом шаге чаще всего из-за не включенных платежей в @BotFather.
    const payload = new URLSearchParams({
      title: 'Пополнение баланса Reel Wallet',
      description: 'Оплата Звёздами Telegram',
      // Для старого метода:
      currency: 'XTR',        // звёзды
      prices: JSON.stringify([{ label: 'Reel Wallet', amount: stars }]),
      payload: JSON.stringify({ kind: 'topup_stars', tg_id: uid }),
      // Для createStarsInvoiceLink можно использовать amount: stars (если метод доступен)
    })

    // Пробуем createStarsInvoiceLink, если вернёт 404 — откатимся на createInvoiceLink:
    let link = ''
    let r = await fetch(TG_API('createStarsInvoiceLink'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload })
    let j = await r.json()
    if (j?.ok && j?.result) {
      link = j.result  // уже вида https://t.me/$slug
    } else {
      // fallback на классический метод
      r = await fetch(TG_API('createInvoiceLink'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload })
      j = await r.json()
      if (j?.ok && j?.result) link = j.result
    }

    if (!link || !link.includes('https://t.me/$')) {
      console.error('invoice link failed', j)
      return res.status(500).json({ ok: false, error: 'INVOICE_FAILED' })
    }

    // 2) отправим пользователю в личку красивую кнопку
    const kb = {
      inline_keyboard: [[{ text: `Оплатить ${stars}⭐ в Telegram`, url: link }]]
    }
    await fetch(TG_API('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: uid,
        text: `Счёт на пополнение: ${stars} ⭐\n\nНажми кнопку ниже, оплата откроется прямо в Telegram.`,
        reply_markup: kb
      })
    }).catch(() => {})

    // 3) оповестим админа (не обязательно)
    if (ADMIN_CHAT_ID) {
      await fetch(TG_API('sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: `🧾 Stars invoice: ${stars}⭐ для tg_id=${uid}\n${link}`
        })
      }).catch(() => {})
    }

    return res.status(200).json({ ok: true, invoice_link: link })
  } catch (e) {
    console.error('topup-stars fatal', e)
    return res.status(500).json({ ok: false, error: 'FATAL' })
  }
}
