import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabaseAdmin';

export type TMAUser = { id: number; username?: string; first_name?: string; last_name?: string; language_code?: string; };
type AuthOk = { ok: true; user: TMAUser; tgId: number };
type AuthErr = { ok: false; status: number; error: string };
type AuthCtx = AuthOk | AuthErr;

function verifyTmaHeader(header: string | null, botToken?: string): AuthCtx {
  if (!header || !header.startsWith('tma ')) return { ok: false, status: 401, error: 'NO_AUTH' };
  if (!botToken) return { ok: false, status: 500, error: 'NO_TG_BOT_TOKEN' };
  const initData = decodeURIComponent(header.slice(4));
  const params = new URLSearchParams(initData);
  const hash = params.get('hash') || ''; params.delete('hash');
  const dataCheckString = Array.from(params.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (calc !== hash) return { ok: false, status: 401, error: 'BAD_SIGNATURE' };
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now()/1000 - authDate > 3600) return { ok: false, status: 401, error: 'EXPIRED' };
  let user: TMAUser | null = null; try { user = params.get('user') ? JSON.parse(params.get('user')!) : null; } catch { user = null; }
  if (!user?.id) return { ok: false, status: 401, error: 'NO_USER' };
  return { ok: true, user, tgId: user.id };
}

function throwJson(status: number, message: string): never {
  throw new Response(JSON.stringify({ ok:false, error: message }), { status, headers: { 'content-type': 'application/json' } });
}

export async function requireUser(req: NextRequest): Promise<{ tgId: number; user: TMAUser }> {
  // @ts-ignore NextRequest in app router
  const header = req.headers.get('authorization');
  const ctx = verifyTmaHeader(header, process.env.TG_BOT_TOKEN);
  if (!('ok' in ctx) || !ctx.ok) throwJson(ctx.status, ctx.error);
  return { tgId: ctx.tgId, user: ctx.user };
}

export async function requireAdmin(req: NextRequest): Promise<{ tgId: number }> {
  const { tgId } = await requireUser(req);
  const allow = (process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allow.includes(String(tgId))) return { tgId };
  try {
    const { data, error } = await supabaseAdmin.from('users').select('role').eq('tg_id', String(tgId)).maybeSingle();
    if (!error && data?.role === 'admin') return { tgId };
  } catch {}
  throwJson(403, 'FORBIDDEN');
}

export default { requireUser, requireAdmin };
