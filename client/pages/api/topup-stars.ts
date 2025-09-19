// pages/api/topup-stars.ts
import type { NextApiRequest, NextApiResponse } from "next";

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_CHAT    = process.env.TELEGRAM_ADMIN_CHAT;    // опционально
const BOT_USERNAME  = process.env.BOT_USERNAME || "";     // например: "reelwallet_bot"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { tg_id, amount_stars, description } = req.body || {};
    const stars = Number(amount_stars);
    if (!tg_id || !stars || stars <= 0) {
      return res.status(400).json({ error: "tg_id and amount_stars are required" });
    }
    if (!BOT_TOKEN) return res.status(500).json({ error: "Server misconfigured: TELEGRAM_BOT_TOKEN" });

    // 1) создаём ссылку на звёздный инвойс (XTR)
    const payload = `topup:${tg_id}:${Date.now()}:${stars}`;
    const invResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Пополнение баланса",
        description: description || "Оплата звёздами Telegram",
        payload,
        provider_token: "",           // для звёзд не нужен
        currency: "XTR",
        prices: [{ label: "Stars", amount: stars }],
      }),
    });
    const invJson = await invResp.json().catch(() => ({} as any));
    if (!invJson?.ok || !invJson?.result) {
      return res.status(500).json({ error: "INVOICE_FAILED", details: invJson });
    }
    const link: string = invJson.result; // формат https://t.me/$...

    // 2) отправляем ЛИЧНО ПОЛЬЗОВАТЕЛЮ кнопку “Оплатить ⭐”
    let userSent = false;
    let needStartBot = false;

    const sendToUser = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: tg_id,
        text: `Пополнение на ${stars} ⭐.\nНажми кнопку ниже и оплати.`,
        reply_markup: {
          inline_keyboard: [[{ text: "Оплатить ⭐", url: link }]],
        },
        disable_web_page_preview: true,
      }),
    });
    const sendUserJson = await sendToUser.json().catch(() => ({} as any));
    if (sendUserJson?.ok) userSent = true;
    // Если юзер не нажимал Start у бота, пришлёт 403 — попросим его открыть бота
    if (!sendUserJson?.ok && (sendUserJson?.error_code === 403 || sendUserJson?.description?.includes("bot was blocked"))) {
      needStartBot = true;
    }

    // 3) опционально уведомляем АДМИНА (отдельным сообщением)
    if (ADMIN_CHAT) {
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT,
          text: `Новая заявка на пополнение ⭐\nTG: ${tg_id}\nСумма: ${stars} ⭐\nСсылка: ${link}`,
          disable_web_page_preview: true,
        }),
      }).catch(()=>{});
    }

    // 4) Отдаём всё фронту
    return res.status(200).json({ ok: true, link, userSent, needStartBot, botUsername: BOT_USERNAME });
  } catch (e:any) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
