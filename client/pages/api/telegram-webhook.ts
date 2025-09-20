// pages/api/telegram-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: true } }

const BOT = process.env.TG_BOT_TOKEN!
const API = `https://api.telegram.org/bot${BOT}`

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  try {
    const update = req.body

    // 1) МГНОВЕННЫЙ ответ на pre_checkout_query — иначе спиннер.
    if (update?.pre_checkout_query?.id) {
      const pcqId: string = update.pre_checkout_query.id
      // если хотите валидацию — сделайте её здесь, но НЕ тормозите ответ
      // успешный ответ
      await fetch(`${API}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_checkout_query_id: pcqId, ok: true })
      }).catch(()=>{})

      // Отдаём 200 сразу, ничего не ждём
      return res.status(200).json({ ok: true })
    }

    // 2) Успешная оплата — записываем в ledger
    const msg = update?.message || update?.edited_message
    const sp = msg?.successful_payment
    if (sp && msg?.from?.id) {
      const tgId = Number(msg.from.id)
      // Telegram Stars: total_amount == кол-во звёзд
      const stars = Number(sp.total_amount || 0)
      if (stars > 0) {
        const url = process.env.SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_KEY
        if (url && key) {
          const supabase = createClient(url, key, { auth: { persistSession: false } })

          // Пишем строку в ledger. Под ваши колонки из скриншота:
          // id (uuid) — автоген, created_at — дефолт now(), status text, type text,
          // tg_id int8, asset_amount numeric (звёзды), amount_rub numeric (звёзды/2), metadata jsonb
          await supabase.from('ledger').insert([{
            type: 'stars_topup',
            status: 'ok',
            tg_id: tgId,
            asset_amount: stars,
            amount_rub: stars / 2,
            metadata: { raw: sp }
          }]).then(()=>{}).catch(()=>{})

          // (не обязательно) телеметрия
          await supabase.from('webhook_logs')
            .insert([{ kind: 'successful_payment', tg_id: tgId, payload: sp }])
            .then(()=>{}).catch(()=>{})
        }
      }

      // Можно отправить юзеру подтверждение (не обязательно)
      // await fetch(`${API}/sendMessage`, { ... })

      return res.status(200).json({ ok: true })
    }

    // 3) Остальные апдейты нам не важны
    return res.status(200).json({ ok: true })
  } catch (e) {
    // Никогда не валим 500 — Телеграм ждёт 200
    return res.status(200).json({ ok: true })
  }
}
