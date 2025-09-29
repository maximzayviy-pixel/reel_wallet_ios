// pages/api/gifts/buy.ts — buy gift from internal balance
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { validateTelegramInitData, parseTelegramUser } from "../../../lib/validateTelegram";

type Json = { ok: true; tme_link: string } | { ok: false; error: string; [k: string]: any };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  if (req.method !== "POST") return res.status(405).end();

  const BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
  if (!BOT_TOKEN) return res.status(500).json({ ok: false, error: "SERVER_MISCONFIG:TG_BOT_TOKEN" });

  const initData =
    (req.headers["x-init-data"] as string) ||
    (req.body?.initData as string) ||
    (req.query?.initData as string) ||
    "";

  if (!initData) return res.status(400).json({ ok: false, error: "NO_INIT_DATA" });
  if (!validateTelegramInitData(initData, BOT_TOKEN))
    return res.status(401).json({ ok: false, error: "INVALID_INIT_DATA" });

  const tgUser = parseTelegramUser(initData);
  if (!tgUser?.id) return res.status(400).json({ ok: false, error: "NO_TELEGRAM_USER" });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const gift_id = Number(req.body?.gift_id);
  if (!gift_id) return res.status(400).json({ ok: false, error: "gift_id_required" });

  // gift
  const { data: gift, error: gErr } = await supabase.from("gifts").select("*").eq("id", gift_id).maybeSingle();
  if (gErr) return res.status(500).json({ ok: false, error: gErr.message });
  if (!gift || gift.enabled === false) return res.status(400).json({ ok: false, error: "gift_not_available" });

  // user
  const { data: userRec, error: uErr } = await supabase.from("users").select("id").eq("tg_id", tgUser.id).maybeSingle();
  if (uErr) return res.status(500).json({ ok: false, error: uErr.message });
  if (!userRec) return res.status(400).json({ ok: false, error: "user_not_found" });

  // balance
  const { data: bal, error: bErr } = await supabase.from("balances").select("available_rub").eq("user_id", userRec.id).maybeSingle();
  if (bErr) return res.status(500).json({ ok: false, error: bErr.message });

  const price = Number(gift.price_rub || 0);
  const available = Number(bal?.available_rub || 0);
  if (available < price) return res.status(400).json({ ok: false, error: "not_enough_funds", available, price });

  // ledger
  const { error: lErr } = await supabase.from("ledger").insert({
    user_id: userRec.id,
    type: "gift_purchase",
    amount_rub: -price,
    metadata: { gift_id, tme_link: gift.tme_link },
  });
  if (lErr) return res.status(500).json({ ok: false, error: lErr.message });

  // debit
  const { error: dErr } = await supabase.rpc("debit_user_balance", { p_user_id: userRec.id, p_amount: price });
  if (dErr) return res.status(500).json({ ok: false, error: dErr.message });

  // order (support different schemas: tg_id / buyer_tg_id / stars_amount)
  const { error: oErr } = await supabase.from("gift_orders").insert({
    user_id: userRec.id,
    tg_id: tgUser.id,
    buyer_tg_id: tgUser.id,
    gift_id,
    price,
    stars_amount: 0,
    status: "paid",
  });
  if (oErr) return res.status(500).json({ ok: false, error: oErr.message });

  return res.status(200).json({ ok: true, tme_link: gift.tme_link });
}
