// pages/api/topup-stars.ts
import type { NextApiRequest, NextApiResponse } from "next";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_CHAT = process.env.TELEGRAM_ADMIN_CHAT; // опционально

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { tg_id, amount_stars, description } = req.body || {};
    const stars = Number(amount_stars);
    if (!tg_id || !stars || stars <= 0) {
      return res.status(400).json({ error: "tg_id and amount_stars are required" });
    }
    if (!BOT_TOKEN) return res.status(500).json({ error: "Server misconfigured: TELEGRAM_BOT_TOKEN" });

    // Обычный invoice с валютой XTR (Stars)
    // payload может быть любым строковым идентификатором
    const payload = `topup:${tg_id}:${Date.now()}:${stars}`;

    const invResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Пополнение баланса",
        description: description || "Оплата звёздами Telegram",
        payload,
        provider_token: "",         // ДЛЯ ЗВЁЗД НЕ НУЖЕН, оставить пустым
        currency: "XTR",            // ВАЖНО: звёзды
        prices: [{ label: "Stars", amount: stars }], // amount = количество звёзд
      })
    });

    const invJson = await invResp.json().catch(() => ({} as any));

    if (!invJson?.ok || !invJson?.result) {
      // Пробросим что ответил Telegram — это поможет в логах
      return res.status(500).json({ error: "INVOICE_FAILED", details: invJson });
    }

    const link: string = invJson.result; // формата https://t.me/$...

    // (Опционально) Уведомим админа
    if (ADMIN_CHAT) {
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT,
          text: `Новая заявка на пополнение ⭐\nTG: ${tg_id}\nСумма: ${stars}⭐\nСсылка: ${link}`
        })
      }).catch(()=>{});
    }

    return res.status(200).json({ ok: true, link });
  } catch (e:any) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
