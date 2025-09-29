import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateTelegramInitData, parseTelegramUser } from '../../lib/validateTelegram';

/**
 * GET `/api/user-info`
 *
 * Returns basic information about the currently authenticated user.  The
 * caller must supply a valid Telegram `initData` string via one of the
 * following locations:
 *   - `x-telegram-init-data` or `x-init-data` HTTP header
 *   - `initData` query parameter
 *   - `initData` property on the request body
 *
 * The `initData` is validated using the Telegram bot token.  Only the
 * authenticated user’s record is returned.  Any attempt to specify
 * arbitrary `tg_id` or `user_id` parameters is ignored.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
  }
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ success: false, error: 'NO_SUPABASE_CREDS' });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // We support two modes of identification for backward compatibility:
  // 1) A valid Telegram initData string provided via headers, query or body.
  //    When present, this takes precedence and authenticates the caller.
  // 2) A fallback tg_id query parameter for legacy clients.  No authentication
  //    is performed when initData is absent, so this should be phased out.
  const initData =
    (req.headers['x-telegram-init-data'] as string) ??
    (req.headers['x-init-data'] as string) ??
    ((req.query.initData as string) ?? '') ??
    ((req.body as any)?.initData ?? '');
  const tgIdQuery = Number((req.query.tg_id as string) ?? 0);
  let tg_id: number | null = null;

  const BOT_TOKEN =
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT ||
    process.env.TG_BOT_TOKEN ||
    process.env.NEXT_PUBLIC_BOT_TOKEN ||
    '';

  if (initData) {
    if (!BOT_TOKEN || !validateTelegramInitData(initData, BOT_TOKEN)) {
      return res.status(401).json({ success: false, error: 'INVALID_INIT_DATA' });
    }
    const tgUser = parseTelegramUser(initData);
    if (!tgUser || !tgUser.id) {
      return res.status(401).json({ success: false, error: 'INVALID_USER' });
    }
    tg_id = Number(tgUser.id);
    if (!Number.isFinite(tg_id) || tg_id <= 0) {
      return res.status(401).json({ success: false, error: 'INVALID_USER' });
    }
    // If caller also provided tg_id param, ensure they match
    if (tgIdQuery && tgIdQuery !== tg_id) {
      return res.status(403).json({ success: false, error: 'TG_ID_MISMATCH' });
    }
  } else {
    // No initData: fall back to insecure tg_id query
    if (!tgIdQuery) {
      return res.status(400).json({ success: false, error: 'tg_id or initData required' });
    }
    tg_id = tgIdQuery;
  }

  const { data, error } = await supabase
    .from('users')
    .select('id,tg_id,username,is_banned,ban_reason,ban_status,ban_appeal,wallet_limit,wallet_restricted,is_verified,role')
    .eq('tg_id', tg_id)
    .maybeSingle();
  if (error || !data) {
    return res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
  }
  const {
    id,
    username,
    is_banned,
    ban_reason,
    ban_status,
    ban_appeal,
    wallet_limit,
    wallet_restricted,
    is_verified,
    role,
  } = data as any;
  return res.status(200).json({
    success: true,
    info: {
      id,
      tg_id,
      username,
      is_banned,
      ban_reason,
      ban_status,
      ban_appeal,
      wallet_limit,
      wallet_restricted,
      is_verified,
      role,
    },
  });
}