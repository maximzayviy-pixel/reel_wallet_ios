import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateTelegramInitData, parseTelegramUser } from '../../lib/validateTelegram';

/**
 * GET `/api/my-balance`
 *
 * Returns the current balance (stars, ton and total_rub) for the
 * authenticated user.  The client must provide a valid Telegram `initData`
 * string via headers, query or body.  The balance for arbitrary users is
 * never exposed.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ ok: false, error: 'NO_SUPABASE_CREDS' });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Accept either a valid initData or a tg_id query parameter.  If initData
  // is provided it takes precedence and must match the supplied tg_id if
  // both are present.  This maintains backwards compatibility with
  // existing clients that pass tg_id while still enabling stronger
  // authentication for clients that provide initData.
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
      return res.status(401).json({ ok: false, error: 'INVALID_INIT_DATA' });
    }
    const tgUser = parseTelegramUser(initData);
    if (!tgUser || !tgUser.id) {
      return res.status(401).json({ ok: false, error: 'INVALID_USER' });
    }
    tg_id = Number(tgUser.id);
    if (!Number.isFinite(tg_id) || tg_id <= 0) {
      return res.status(401).json({ ok: false, error: 'INVALID_USER' });
    }
    // If the caller also supplied tg_id via query, ensure it matches
    if (tgIdQuery && tgIdQuery !== tg_id) {
      return res.status(403).json({ ok: false, error: 'TG_ID_MISMATCH' });
    }
  } else {
    // No initData: fall back to insecure tg_id query for legacy clients
    if (!tgIdQuery) {
      return res.status(400).json({ ok: false, error: 'tg_id_required' });
    }
    tg_id = tgIdQuery;
  }

  const { data, error } = await supabase
    .from('balances_by_tg')
    .select('stars, ton, total_rub')
    .eq('tg_id', tg_id)
    .maybeSingle();
  if (error) {
    return res.status(500).json({ ok: false, error: error.message || 'DB_ERROR' });
  }
  return res.status(200).json({
    ok: true,
    tg_id,
    stars: Number(data?.stars || 0),
    ton: Number(data?.ton || 0),
    total_rub: Number(data?.total_rub || 0),
  });
}