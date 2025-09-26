
// client/pages/api/admin/_guard.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateTelegramInitData, parseTelegramUser } from '../../../lib/validateTelegram';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || '';

export async function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  const initData = (req.headers['x-telegram-init-data'] as string) || (req.query.initData as string);
  if (!initData || !validateTelegramInitData(initData, BOT_TOKEN)) {
    res.status(403).json({ error: 'FORBIDDEN: bad telegram signature' });
    return null;
  }
  const tgUser = parseTelegramUser(initData);
  if (!tgUser?.id) {
    res.status(403).json({ error: 'FORBIDDEN: no tg user' });
    return null;
  }
  const { data, error } = await supabase
    .from('users')
    .select('id, tg_id, username, role, is_banned')
    .eq('tg_id', tgUser.id)
    .maybeSingle();
  if (error || !data) { res.status(403).json({ error: 'FORBIDDEN: user not found' }); return null; }
  if (data.is_banned) { res.status(403).json({ error: 'BANNED' }); return null; }
  if (data.role !== 'admin') { res.status(403).json({ error: 'ADMIN_ONLY' }); return null; }
  return data;
}

// lightweight probe for frontend guard
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;
  res.json({ ok: true, user });
}
