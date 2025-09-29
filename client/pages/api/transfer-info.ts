// pages/api/transfer-info.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateTelegramInitData, parseTelegramUser } from '../../lib/validateTelegram';

export const config = { api: { bodyParser: true } };

const ok = (res: NextApiResponse, body: any = { ok: true }) => res.status(200).json(body);
const bad = (res: NextApiResponse, code: number, error: string) =>
  res.status(code).json({ ok: false, error });

/**
 * GET `/api/transfer-info`
 *
 * Returns information about a specific P2P transfer.  The caller must be
 * either the sender or the receiver; otherwise a 403 error is returned.
 * Transfer records are looked up by the `transfer_id` stored inside the
 * `metadata` column of the `ledger` table.  The Telegram `initData`
 * provided with the request is used to authenticate the caller.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return bad(res, 405, 'METHOD_NOT_ALLOWED');
  const transfer_id = String(req.query.transfer_id || '');
  if (!transfer_id) return bad(res, 400, 'NO_TRANSFER_ID');

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!SUPABASE_URL || !SERVICE_KEY) return bad(res, 500, 'NO_SUPABASE_CREDS');

  // Validate Telegram init data to identify the caller
  const initData =
    (req.headers['x-telegram-init-data'] as string) ??
    (req.headers['x-init-data'] as string) ??
    ((req.query.initData as string) ?? '') ??
    ((req.body as any)?.initData ?? '');
  const BOT_TOKEN =
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT ||
    process.env.TG_BOT_TOKEN ||
    process.env.NEXT_PUBLIC_BOT_TOKEN ||
    '';
  if (!initData || !BOT_TOKEN) return bad(res, 401, 'NO_INIT_DATA');
  if (!validateTelegramInitData(initData, BOT_TOKEN)) return bad(res, 401, 'INVALID_INIT_DATA');
  const tgUser = parseTelegramUser(initData);
  if (!tgUser || !tgUser.id) return bad(res, 401, 'INVALID_USER');
  const currentId = Number(tgUser.id);
  if (!Number.isFinite(currentId) || currentId <= 0) return bad(res, 401, 'INVALID_USER');

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  try {
    const { data, error } = await supabase
      .from('ledger')
      .select('id, tg_id, type, asset_amount, amount_rub, created_at, metadata')
      .contains('metadata', { transfer_id });
    if (error) return bad(res, 500, 'DB_ERROR');
    // expect two records: one negative (sender) and one positive (receiver)
    const send = data?.find((r) => Number(r.asset_amount) < 0);
    const recv = data?.find((r) => Number(r.asset_amount) > 0);
    if (!send || !recv) return bad(res, 404, 'TRANSFER_NOT_FOUND');
    // authorize: the caller must be involved in the transfer
    if (send.tg_id !== currentId && recv.tg_id !== currentId) {
      return bad(res, 403, 'FORBIDDEN');
    }
    return ok(res, {
      ok: true,
      transfer_id,
      created_at: send.created_at || recv.created_at,
      from_tg_id: send.tg_id,
      to_tg_id: recv.tg_id,
      amount_stars: Math.abs(Number(send.asset_amount)),
      amount_rub: Math.abs(Number(send.amount_rub || 0)),
      note: (send.metadata && (send.metadata as any).note) || null,
    });
  } catch (e) {
    return bad(res, 500, 'SERVER_ERROR');
  }
}