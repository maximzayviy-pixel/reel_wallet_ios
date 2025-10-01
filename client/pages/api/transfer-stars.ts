// pages/api/transfer-stars.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: true } };

type Body = {
  from_tg_id?: number;
  to_tg_id?: number;
  amount_stars?: number; // целое, >=1
  note?: string;
};

const ok = (res: NextApiResponse, body: any = { ok: true }) =>
  res.status(200).json(body);
const bad = (res: NextApiResponse, code: number, error: string) =>
  res.status(code).json({ ok: false, error });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return ok(res, { ok: true });

  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const LEDGER = process.env.TABLE_LEDGER || "ledger";
  const REFRESH_BALANCES_RPC = process.env.RPC_REFRESH_BALANCES || "";

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return bad(res, 500, "NO_SUPABASE_CREDS");
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  let { from_tg_id, to_tg_id, amount_stars, note } = (req.body || {}) as Body;

  // в хедере может быть initData, но тут его не валидируем — это отдельная задача
  // const initData = req.headers["x-telegram-init-data"] as string | undefined;

  // валидации
  from_tg_id = Number(from_tg_id || 0);
  to_tg_id = Number(to_tg_id || 0);
  amount_stars = Math.floor(Number(amount_stars || 0));

  if (!from_tg_id || !to_tg_id) return bad(res, 400, "BAD_IDS");
  if (from_tg_id === to_tg_id) return bad(res, 400, "SELF_TRANSFER_FORBIDDEN");
  if (!amount_stars || amount_stars <= 0) return bad(res, 400, "BAD_AMOUNT");

  try {
    // убедимся, что оба юзера существуют (минимально)
    const { data: fromUser } = await supabase
      .from("users")
      .select("id,tg_id")
      .eq("tg_id", from_tg_id)
      .maybeSingle();
    if (!fromUser) return bad(res, 402, "SENDER_NOT_FOUND");

    const { data: toUser } = await supabase
      .from("users")
      .select("id,tg_id")
      .eq("tg_id", to_tg_id)
      .maybeSingle();
    if (!toUser) return bad(res, 404, "RECEIVER_NOT_FOUND");

    // баланс отправителя
    const { data: balRow } = await supabase
      .from("balances_by_tg")
      .select("stars")
      .eq("tg_id", from_tg_id)
      .maybeSingle();

    const senderStars = Number(balRow?.stars || 0);
    if (senderStars < amount_stars) return bad(res, 402, "INSUFFICIENT_FUNDS");

    // расчёт рублёвого эквивалента
    const rate = 0.5; // 2⭐ = 1₽
    const rub = amount_stars * rate;

    // связующий id перевода — удобно для аудита
    const transfer_id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // две проводки в ledger
    const payloadCommon = {
      rate_used: rate,
      status: "ok",
      metadata: {
        kind: "p2p",
        transfer_id,
        note: note?.slice(0, 120) || null,
      } as any,
    };

    const { error: insErr } = await supabase.from(LEDGER).insert([
      // списание у отправителя
      {
        user_id: fromUser.id,
        tg_id: from_tg_id,
        type: "p2p_send",
        amount: -amount_stars, // -⭐
        amount_rub: -rub, // минус эквивалент
        delta: -amount_stars,
        asset_amount: -amount_stars,
        ...payloadCommon,
      },
      // зачисление у получателя
      {
        user_id: toUser.id,
        tg_id: to_tg_id,
        type: "p2p_recv",
        amount: amount_stars, // +⭐
        amount_rub: rub,
        delta: amount_stars,
        asset_amount: amount_stars,
        ...payloadCommon,
      },
    ]);

    if (insErr) {
      console.error("ledger insert failed:", insErr);
      return bad(res, 500, "LEDGER_WRITE_FAILED");
    }

    // Обновляем баланс обоих пользователей
    try {
      await supabase.rpc('update_user_balance_by_tg_id', { p_tg_id: from_tg_id });
      await supabase.rpc('update_user_balance_by_tg_id', { p_tg_id: to_tg_id });
      console.log('Balances updated for transfer:', { from_tg_id, to_tg_id });
    } catch (balanceError) {
      console.error('Balance update failed:', balanceError);
      // Не прерываем выполнение, так как основная операция выполнена
    }

    // опционально обновить материализованное представление
    if (REFRESH_BALANCES_RPC) {
      try {
        await supabase.rpc(REFRESH_BALANCES_RPC as any);
      } catch {}
    }

    // лог (необязательно)
    try {
      await supabase.from("webhook_logs").insert([
        {
          kind: "p2p_transfer",
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
    console.error("transfer-stars error:", e?.message || e);
    return bad(res, 500, "SERVER_ERROR");
  }
}
