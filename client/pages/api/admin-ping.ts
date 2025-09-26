// client/pages/api/admin-ping.ts
const BOT = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT;
const ADMIN = process.env.ADMIN_TG_ID || process.env.TELEGRAM_ADMIN_CHAT;

export default async function handler(_req, res) {
  // Protect the ping endpoint so that only admins can trigger Telegram messages.
  const { requireAdmin } = await import('./_adminAuth');
  if (!requireAdmin(_req as any, res as any)) return;
  if (!BOT || !ADMIN) return res.status(500).json({ ok:false, error:'BOT or ADMIN env missing' });
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ chat_id: ADMIN, text: 'Ping from Vercel ✅' })
    });
    const j = await r.json();
    return res.status(200).json(j);
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:e.message });
  }
}
