// pages/api/my-balance.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Row = {
  tg_id: number;
  stars: number | null;
  ton: number | null;
  total_rub: number | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const debug = String(req.query.debug || "") === "1";

  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const tg_id = Number(req.query.tg_id);
    if (!tg_id) {
      return res.status(400).json({ ok: false, error: "tg_id_required" });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY; // ОБЯЗАТЕЛЬНО service key
    if (!url || !key) {
      const msg = "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY";
      if (debug) return res.status(500).json({ ok: false, error: msg });
      return res.status(500).end("Internal Server Error");
    }

    const supabase = createClient(url, key);

    // balances_by_tg — это VIEW или MATERIALIZED VIEW c колонками:
    // tg_id int8, stars numeric, ton numeric, total_rub numeric
    const { data, error } = await supabase
      .from("balances_by_tg")
      .select("*")
      .eq("tg_id", tg_id)
      .maybeSingle<Row>();

    if (error) {
      if (debug) return res.status(500).json({ ok: false, error: error.message });
      return res.status(500).end("Internal Server Error");
    }

    const stars = Number(data?.stars || 0);
    const ton = Number(data?.ton || 0);
    const total_rub = Number(data?.total_rub || 0);

    return res.status(200).json({
      ok: true,
      tg_id,
      stars,
      ton,
      total_rub,
    });
  } catch (e: any) {
    if (debug) {
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
    return res.status(500).end("Internal Server Error");
  }
}
