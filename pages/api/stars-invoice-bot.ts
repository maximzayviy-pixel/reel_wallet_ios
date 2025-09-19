import type { NextApiRequest, NextApiResponse } from 'next';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const BOT_USERNAME = process.env.BOT_USERNAME || 'reelwallet_bot';

async function sendMessage(chatId: number, text: string, button?: { text: string; url: string }) {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (button) {
    body.reply_markup = { inline_keyboard: [[{ text: button.text, url: button.url }]] };
  }
  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return resp.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const method = req.method || 'GET';
    const amountStars = Number((method === 'GET' ? (req.query.amount_stars as any) : (req.body?.amount_stars)) ?? 0);
    const tgId = Number((method === 'GET' ? (req.query.tg_id as any) : (req.body?.tg_id)));
    if (!tgId || !amountStars) return res.status(400).json({ ok: false, error: 'tg_id and amount_stars required' });

    const payload = encodeURIComponent(JSON.stringify({ tg_id: tgId, amount_stars: amountStars, ts: Date.now() }));
    const link = `https://t.me/${BOT_USERNAME}?startapp=pay_${payload}`;

    const sent = await sendMessage(tgId, `Оплатите <b>${amountStars}</b> ⭐ через Telegram Stars`, {
      text: 'Оплатить ⭐',
      url: link,
    });

    return res.status(200).json({ ok: true, link, sent });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}