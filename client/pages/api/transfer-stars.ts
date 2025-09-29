// pages/api/transfer-stars.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { validateTelegramInitData, parseTelegramUser } from '../../lib/validateTelegram';

export const config = { api: { bodyParser: true } };

type Body = {
  to_tg_id?: number;
  amount_stars?: number; // целое, >=1
  note?: string;
};

const ok = (res: NextApiResponse, body: any = { ok: true }) =>
  res.status(200).json(body);
const bad = (res: NextApiResponse, code: number, error: string) =>
  res.status(code).json({ ok: false, error });

/**
 * POST `/api/transfer-stars`
 *
 * Executes a P2P transfer of stars from the authenticated user to the
 * specified recipient.  The caller must supply a valid Telegram `initData`
 * string in headers, query or body.  The sender’s Telegram ID is taken
 * from the validated `initData` and cannot be spoofed by the client.
 *
 * Body parameters:
 *   - `to_tg_id`     (number, required)   — Telegram ID of the recipient
 *   - `amount_stars` (number, required)   — integer amount of stars to send
 *   - `note`         (string, optional)   — free text, truncated to 120 chars
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return bad(res, 405, 'METHOD_NOT_ALLOWED');
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const LEDGER = process.env.TABLE_LEDGER || 'ledger';
  const REFRESH_BALANCES_RPC = process.env.RPC_REFRESH_BALANCES || '';
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return bad(res, 500, 'NO_SUPABASE_CREDS');
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Extract initData and validate
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
  let from_tg_id = Number(tgUser.id);
  if (!Number.isFinite(from_tg_id) || from_tg_id <= 0) return bad(res, 401, 'INVALID_USER');

  // Parse body.  We ignore any supplied from_tg_id and enforce the one
  // derived from initData.  Only to_tg_id and amount_stars are accepted.
  let { to_tg_id, amount_stars, note } = (req.body || {}) as Body;
  to_tg_id = Number(to_tg_id || 0);
  amount_stars = Math.floor(Number(amount_stars || 0));

  if (!to_tg_id) return bad(res, 400, 'BAD_IDS');
  if (from_tg_id === to_tg_id) return bad(res, 400, 'SELF_TRANSFER_FORBIDDEN');
  if (!amount_stars || amount_stars <= 0) return bad(res, 400, 'BAD_AMOUNT');

  try {
    // Validate both users exist and are not banned
    const { data: fromUser } = await supabase
      .from('users')
      .select('id,tg_id,is_banned')
      .eq('tg_id', from_tg_id)
      .maybeSingle();
    if (!fromUser) return bad(res, 402, 'SENDER_NOT_FOUND');
    if (fromUser.is_banned) return bad(res, 403, 'SENDER_BANNED');

    const { data: toUser } = await supabase
      .from('users')
      .select('id,tg_id,is_banned')
      .eq('tg_id', to_tg_id)
      .maybeSingle();
    if (!toUser) return bad(res, 404, 'RECEIVER_NOT_FOUND');
    if (toUser.is_banned) return bad(res, 403, 'RECEIVER_BANNED');

    // Check sender's balance
    const { data: balRow } = await supabase
      .from('balances_by_tg')
      .select('stars')
      .eq('tg_id', from_tg_id)
      .maybeSingle();
    const senderStars = Number(balRow?.stars || 0);
    if (senderStars < amount_stars) return bad(res, 402, 'INSUFFICIENT_FUNDS');

    // Determine rub equivalent
    const rate = 0.5; // 2⭐ = 1₽
    const rub = amount_stars * rate;

    const transfer_id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? (crypto as any).randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const payloadCommon = {
      rate_used: rate,
      status: 'ok',
      metadata: {
        kind: 'p2p',
        transfer_id,
        note: note?.slice(0, 120) || null,
      } as any,
    };

    const { error: insErr } = await supabase.from(LEDGER).insert([
      {
        tg_id: from_tg_id,
        type: 'p2p_send',
        asset_amount: -amount_stars,
        amount_rub: -rub,
        ...payloadCommon,
      },
      {
        tg_id: to_tg_id,
        type: 'p2p_recv',
        asset_amount: amount_stars,
        amount_rub: rub,
        ...payloadCommon,
      },
    ]);
    if (insErr) {
      console.error('ledger insert failed:', insErr);
      return bad(res, 500, 'LEDGER_WRITE_FAILED');
    }
    // Optionally refresh materialized balances
    if (REFRESH_BALANCES_RPC) {
      try {
        await supabase.rpc(REFRESH_BALANCES_RPC as any);
      } catch (e) {
        // ignore refresh errors
      }
    }
    // Log the transfer
    try {
      await supabase.from('webhook_logs').insert([
        {
          kind: 'p2p_transfer',
          tg_id: from_tg_id,
          payload: {
            to_tg_id,
            amount_stars,
            transfer_id,
          },
        },
      ]);
    } catch {}

    return ok(res, {
      ok: true,
      transfer_id,
      from_tg_id,
      to_tg_id,
      amount_stars,
      amount_rub: rub,
    });
  } catch (e: any) {
    console.error('transfer-stars error:', e?.message || e);
    return bad(res, 500, 'SERVER_ERROR');
  }
}