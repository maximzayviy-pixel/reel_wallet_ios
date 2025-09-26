export async function notifyUser(tg_id: string, text: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tg_id, text, parse_mode: 'HTML' })
    });
  } catch (e) {
    console.error('Notify error', e);
  }
}
