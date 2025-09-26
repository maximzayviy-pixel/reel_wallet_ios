import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

export type TMAUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

type AuthCtx =
  | { ok: true; user: TMAUser; tgId: number }
  | { ok: false; status: number; error: string };

function verifyTmaHeader(header: string | undefined, botToken: string): AuthCtx {
  if (!header || !header.startsWith('tma ')) return { ok: false, status: 401, error: 'NO_AUTH' };
  const initData = decodeURIComponent(header.slice(4));
  const params = new URLSearchParams(initData);

  const hash = params.get('hash') || '';
  params.delete('hash');

  // Build data_check_string
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // Telegram Mini Apps secret: HMAC-SHA256(botToken) with key "WebAppData"
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (calc !== hash) return { ok: false, status: 401, error: 'BAD_SIGNATURE' };

  // Anti-replay
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > 3600) return { ok: false, status: 401, error: 'EXPIRED' };

  const userStr = params.get('user');
  let user: TMAUser | null = null;
  try { user = userStr ? JSON.parse(userStr) : null; } catch { user = null; }
  if (!user?.id) return { ok: false, status: 401, error: 'NO_USER' };

  return { ok: true, user, tgId: user.id };
}

export async function requireUser(req: NextApiRequest, res: NextApiResponse) {
  const ctx = verifyTmaHeader(req.headers['authorization'] as string | undefined, process.env.TG_BOT_TOKEN as string);
  if (!ctx.ok) {
    res.status(ctx.status).json({ ok: false, error: ctx.error });
    throw new Error(ctx.error);
  }
  return { tgId: ctx.tgId, user: ctx.user };
}

export async function requireAdmin(req: NextApiRequest, res: NextApiResponse, supabase: any) {
  const { tgId } = await requireUser(req, res);
  const allow = (process.env.ADMIN_TG_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.includes(String(tgId))) return { tgId };

  // optional DB-backed role check
  if (supabase) {
    const { data, error } = await supabase.from('users').select('role').eq('tg_id', String(tgId)).maybeSingle();
    if (!error && data?.role === 'admin') return { tgId };
  }

  res.status(403).json({ ok: false, error: 'FORBIDDEN' });
  throw new Error('FORBIDDEN');
}
