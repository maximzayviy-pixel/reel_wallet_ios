
// client/lib/validateTelegram.ts
import crypto from 'crypto';

export function validateTelegramInitData(initData: string, botToken: string): boolean {
  if (!initData || !botToken) return false;
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  if (!hash) return false;
  const data: string[] = [];
  urlParams.forEach((v, k) => { if (k !== 'hash') data.push(`${k}=${v}`); });
  data.sort();
  const dataCheckString = data.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calcHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(calcHash), Buffer.from(hash));
}

export function parseTelegramUser(initData: string): any | null {
  try {
    const urlParams = new URLSearchParams(initData);
    const user = urlParams.get('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}
