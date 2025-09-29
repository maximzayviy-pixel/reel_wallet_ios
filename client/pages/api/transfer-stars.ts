// pages/api/transfer-stars.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

type CreateClient = typeof createClient;

let createSupabaseClient: CreateClient = createClient;

export function __setSupabaseClientFactory(factory?: CreateClient) {
  createSupabaseClient = factory || createClient;
}

export const config = { api: { bodyParser: true } };

type Body = {
  from_tg_id?: number;
  to_tg_id?: number;
  amount_stars?: number; // целое, >=1
  note?: string;
};

const TELEGRAM_INIT_HEADERS = [
  "x-telegram-init-data",
  "x-init-data",
  "authorization",
] as const;

type AuthResult =
  | { ok: true; tgId: number }
  | { ok: false; status: number; error: string };

function getBotToken() {
  return (
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TG_BOT_TOKEN ||
    process.env.TELEGRAM_BOT ||
    ""
  );
}

function parseInitData(raw: string) {
  try {
    return new URLSearchParams(raw);
  } catch {
    return null;
  }
}

function validateTelegramAuth(req: NextApiRequest): AuthResult {
  const rawInitData = TELEGRAM_INIT_HEADERS.reduce<string | undefined>((acc, key) => {
    if (acc) return acc;
    const value = req.headers[key] as string | undefined;
    if (!value) return acc;
    return value;
  }, undefined);

  if (!rawInitData) {
    return { ok: false, status: 401, error: "AUTH_REQUIRED" };
  }

  const botToken = getBotToken();
  if (!botToken) {
    return { ok: false, status: 500, error: "NO_BOT_TOKEN" };
  }

  const params = parseInitData(rawInitData);
  if (!params) {
    return { ok: false, status: 401, error: "BAD_AUTH_PAYLOAD" };
  }

  const receivedHash = params.get("hash");
  if (!receivedHash) {
    return { ok: false, status: 401, error: "BAD_AUTH_PAYLOAD" };
  }

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key === "hash") return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  try {
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();
    const calcHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");
    const calcBuf = Buffer.from(calcHash, "hex");
    const recvBuf = Buffer.from(receivedHash, "hex");
    if (calcBuf.length !== recvBuf.length) {
      return { ok: false, status: 401, error: "INVALID_AUTH" };
    }
    if (!crypto.timingSafeEqual(calcBuf, recvBuf)) {
      return { ok: false, status: 401, error: "INVALID_AUTH" };
    }
  } catch {
    return { ok: false, status: 401, error: "INVALID_AUTH" };
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    return { ok: false, status: 403, error: "NO_TELEGRAM_USER" };
  }

  try {
    const parsed = JSON.parse(userRaw);
    const tgId = Number(parsed?.id || 0);
    if (!tgId) {
      return { ok: false, status: 403, error: "NO_TELEGRAM_USER" };
    }
    return { ok: true, tgId };
  } catch {
    return { ok: false, status: 403, error: "NO_TELEGRAM_USER" };
  }
}

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
  const supabase = createSupabaseClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const auth = validateTelegramAuth(req);
  if (!auth.ok) {
    return bad(res, auth.status, auth.error);
  }

  const body = (req.body || {}) as Body;
  const tamperedFrom = Number(body?.from_tg_id || 0);
  if (tamperedFrom && tamperedFrom !== auth.tgId) {
    return bad(res, 403, "FROM_ID_MISMATCH");
  }

  let { to_tg_id, amount_stars, note } = body;
  let from_tg_id = auth.tgId;

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
    if (Number(fromUser.tg_id) !== from_tg_id)
      return bad(res, 403, "SENDER_MISMATCH");

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
        tg_id: from_tg_id,
        type: "p2p_send",
        asset_amount: -amount_stars, // -⭐
        amount_rub: -rub, // минус эквивалент
        ...payloadCommon,
      },
      // зачисление у получателя
      {
        tg_id: to_tg_id,
        type: "p2p_recv",
        asset_amount: amount_stars, // +⭐
        amount_rub: rub,
        ...payloadCommon,
      },
    ]);

    if (insErr) {
      console.error("ledger insert failed:", insErr);
      return bad(res, 500, "LEDGER_WRITE_FAILED");
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
