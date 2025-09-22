// pages/api/topup-stars.ts
import type { NextApiRequest, NextApiResponse } from "next";

const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN!;
const BOT_USERNAME = process.env.BOT_USERNAME || "";          // например: reelwallet_bot
const ADMIN_CHAT   = process.env.TELEGRAM_ADMIN_CHAT || "";    // опционально

async function telegram(method: string, body: any) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: j?.ok, result: j?.result, raw: j };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!BOT_TOKEN) return res.status(500).json({ error: "Server misconfigured: TELEGRAM_BOT_TOKEN" });

    const { tg_id, amount_stars, business_connection_id, description } = req.body || {};
    const stars = Number(amount_stars);
    if (!tg_id || !stars || stars <= 0) {
      return res.status(400).json({ error: "tg_id and amount_stars are required" });
    }

    const payload = `topup:${tg_id}:${Date.now()}:${stars}`;
    const title = "Пополнение баланса";
    const desc  = description || "Оплата звёздами Telegram";

    // 1) Пытаемся отправить инвойс ПОЛЬЗОВАТЕЛЮ через sendInvoice
    //    (для мини-аппов важен business_connection_id)
    let invoiceUrl: string | null = null;
    let userSent = false;
    let needStartBot = false;

    const sendBody: any = {
      chat_id: tg_id,
      title,
      description: desc,
      payload,
      provider_token: "",          // для Stars не нужен
      currency: "XTR",
      prices: [{ label: "Stars", amount: stars }], // для XTR amount = кол-во звёзд (без *100)
    };
    if (business_connection_id) sendBody.business_connection_id = business_connection_id;

    const sent = await telegram("sendInvoice", sendBody);

    if (sent.ok) {
      userSent = true;

      // параллельно уведомим админа (опционально)
      if (ADMIN_CHAT) {
        telegram("sendMessage", {
          chat_id: ADMIN_CHAT,
          text: `Новая заявка на ⭐\nTG: ${tg_id}\nСумма: ${stars} ⭐`,
          disable_web_page_preview: true,
        }).catch(()=>{});
      }

      return res.status(200).json({
        ok: true,
        userSent: true,
        invoiceMessageId: sent.result?.message_id,
        botUsername: BOT_USERNAME,
      });
    }

    // если пользователь не нажал Start у бота — 403/blocked
    if (sent.raw?.error_code === 403 || String(sent.raw?.description || "").includes("blocked")) {
      needStartBot = true;
    }

    // 2) Fallback: создаём ссылку через createInvoiceLink (работает и вне бизнес-соединения)
    const linkResp = await telegram("createInvoiceLink", {
      title,
      description: desc,
      payload,
      provider_token: "",
      currency: "XTR",
      prices: [{ label: "Stars", amount: stars }],
    });

    if (!linkResp.ok || !linkResp.result) {
      return res.status(500).json({
        error: "INVOICE_FAILED",
        details: linkResp.raw,
      });
    }
    invoiceUrl = linkResp.result as string;

    // шлём пользователю ЛС с кнопкой (если не заблокировал бота)
    if (!needStartBot) {
      const sentPm = await telegram("sendMessage", {
        chat_id: tg_id,
        text: `Пополнение на ${stars} ⭐.\nНажми кнопку ниже и оплати.`,
        reply_markup: { inline_keyboard: [[{ text: "Оплатить ⭐", url: invoiceUrl }]] },
        disable_web_page_preview: true,
      });
      userSent = !!sentPm.ok;
      if (ADMIN_CHAT) {
        telegram("sendMessage", {
          chat_id: ADMIN_CHAT,
          text: `Новая заявка на ⭐ (через ссылку)\nTG: ${tg_id}\nСумма: ${stars} ⭐\nСсылка: ${invoiceUrl}`,
        }).catch(()=>{});
      }
    }

    return res.status(200).json({
      ok: true,
      link: invoiceUrl,
      userSent,
      needStartBot,
      botUsername: BOT_USERNAME,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
