import crypto from 'crypto';
import { headers as nextHeaders } from 'next/headers';

// Минимальный «req», достаточный для чтения заголовков
type MinimalReq = { headers: { get(name: string): string | null } };

export type TMAUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

type AuthOk = { ok: true; user: TMAUser; tgId: number };
type AuthErr = { ok: false; status: number; error: string };
type AuthCtx = AuthOk | AuthErr;

function getAuthHeader(req?: MinimalReq): string | null {
  // Если нам передали req (роут-хэндлер) — берём из него
  if (req?.headers?.get) return req.headers.get('authorization');
  // Иначе читаем заголовки текущего серверного рендера (страница/лейаут)
  try {
    return nextHeaders().get('authorization');
  } catch {
    return null;
  }
}

function verifyTmaHeader(header: string | null, botToken?: string): AuthCtx {
  if (!header || !header.startsWith('tma ')) return { ok: false, status: 401, error: 'NO_AUTH' };
  if (!botToken) return { ok: false, status: 500, error: 'NO_TG_BOT_TOKEN' };

  const initData = decodeURIComponent(header.slice(4));
  const params = new URLSearchParams(initData);

  const hash = params.get('hash') || '';
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // Секрет Mini Apps: HMAC-SHA256(botToken) с ключом "WebAppData"
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (calc !== hash) return { ok: false, status: 401, error: 'BAD_SIGNATURE' };

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > 3600) return { ok: false, status: 401, error: 'EXPIRED' };

  let user: TMAUser | null = null;
  try {
    user = params.get('user') ? JSON.parse(params.get('user')!) : null;
  } catch {
    user = null;
  }
  if (!user?.id) return { ok: false, status: 401, error: 'NO_USER' };

  return { ok: true, user, tgId: user.id };
}

function throwJson(status: number, message: string): never {
  throw new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Работает и как requireUser(req), и просто requireUser() внутри серверных страниц */
export async function requireUser(req?: MinimalReq): Promise<{ tgId: number; user: TMAUser }> {
  const header = getAuthHeader(req);
  const ctx = verifyTmaHeader(header, process.env.TG_BOT_TOKEN);
  if (!('ok' in ctx) || !ctx.ok) throwJson(ctx.status, ctx.error);
  return { tgId: ctx.tgId, user: ctx.user };
}

/** Работает и как requireAdmin(req), и просто requireAdmin() внутри серверных страниц */
export async function requireAdmin(req?: MinimalReq): Promise<{ tgId: number }> {
  const { tgId } = await requireUser(req);
  const allow = (process.env.ADMIN_TG_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.includes(String(tgId))) return { tgId };

  // Доп.проверка роли из БД (необязательно, но полезно)
  try {
    const { supabaseAdmin } = await import('./supabaseAdmin');
    const { data, error } = await supabaseAdmin.from('users').select('role').eq('tg_id', String(tgId)).maybeSingle();
    if (!error && data?.role === 'admin') return { tgId };
  } catch {
    // игнорируем, если supabase недоступен в момент вызова
  }

  throwJson(403, 'FORBIDDEN');
}

export default { requireUser, requireAdmin };
