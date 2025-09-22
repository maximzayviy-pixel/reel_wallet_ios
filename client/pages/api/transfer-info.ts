// pages/api/transfer-info.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: true } };

const ok = (res: NextApiResponse, body: any = { ok: true }) => res.status(200).json(body);
const bad = (res: NextApiResponse, code: number, error: string) => res.status(code).json({ ok: false, error });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return ok(res, { ok: true });

  const transfer_id = String(req.query.transfer_id || "");
  if (!transfer_id) return bad(res, 400, "NO_TRANSFER_ID");

  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!SUPABASE_URL || !SERVICE_KEY) return bad(res, 500, "NO_SUPABASE_CREDS");
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const { data, error } = await supabase
      .from("ledger")
      .select("id, tg_id, type, asset_amount, amount_rub, created_at, metadata")
      .contains("metadata", { transfer_id }); // metadata->>transfer_id == transfer_id

    if (error) return bad(res, 500, "DB_ERROR");

    // ожидаем 2 записи: -⭐ (отправитель), +⭐ (получатель)
    const send = data?.find(r => Number(r.asset_amount) < 0);
    const recv = data?.find(r => Number(r.asset_amount) > 0);

    if (!send || !recv) return bad(res, 404, "TRANSFER_NOT_FOUND");

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
    return bad(res, 500, "SERVER_ERROR");
  }
}
