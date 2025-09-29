import type { NextApiRequest, NextApiResponse } from "next";
import list, { ListOptions } from "./_list";
import { requireAdmin } from "./_guard";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// ⚠️ Жёстко убираем колонку currency из GET, чтобы не падало на схемах без неё.
const opts: ListOptions = {
  table: "ledger",
  columns: "id,tg_id,amount,reason,created_at",
  searchCols: ["tg_id","reason"]
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return list(req, res, opts);
  }

  if (req.method === "POST") {
    try {
      const user = await requireAdmin(req, res);
      if (!user) return;

      const { tg_id, amount, currency = "RUB", reason = "admin_adjustment" } = req.body || {};
      if (!tg_id || !amount) return res.status(400).json({ ok: false, error: "tg_id and amount required" });

      const { error } = await supabaseAdmin.rpc("admin_credit_balance", {
        p_tg_id: tg_id,
        p_amount: amount,
        p_currency: currency,
        p_reason: reason,
      });
      if (error) return res.status(400).json({ ok: false, error: error.message });

      return res.status(200).json({ ok: true });
    } catch (e: any) {
      if (e instanceof Response) {
        const text = await e.text();
        return res.status(e.status || 500).send(text);
      }
      return res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
    }
  }

  res.setHeader("Allow", "GET,POST");
  res.status(405).end();
}