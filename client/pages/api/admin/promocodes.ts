import type { NextApiRequest, NextApiResponse } from "next";
import list, { ListOptions } from "./_list";
import { requireAdmin } from "./_guard";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const opts: ListOptions = {
  table: "promocodes",
  columns: "id,code,amount,currency,uses_left,created_at",
  searchCols: ["code","currency"]
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") return list(req, res, opts);
  if (req.method === "POST") {
    try {
      const user = await requireAdmin(req, res);
      if (!user) return;
      const { code, amount, currency, uses = 1 } = req.body || {};
      if (!code || !amount || !currency) return res.status(400).json({ ok:false, error:"code, amount, currency required" });
      const { error } = await supabaseAdmin.from("promocodes").insert({ code, amount, currency, uses_left: uses });
      if (error) return res.status(400).json({ ok:false, error: error.message });
      return res.status(200).json({ ok:true });
    } catch (e:any) {
      if (e instanceof Response) {
        const text = await e.text();
        return res.status(e.status || 500).send(text);
      }
      return res.status(500).json({ ok:false, error: e?.message || "SERVER_ERROR" });
    }
  }
  res.setHeader("Allow", "GET,POST");
  res.status(405).end();
}