// pages/api/gifts/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    const { data, error } = await supabase
      .from("gifts")
      .select(
        [
          "id",
          "title",
          "slug",
          "number",
          "tme_link",
          "price_rub",
          "value_rub",
          "image_url",
          "anim_url",
          "tgs_url",
          "model",
          "backdrop",
          "pattern",
          "amount_issued",
          "amount_total",
        ].join(",")
      )
      .order("id", { ascending: true });

    if (error) throw error;
    return res.json({ ok: true, items: data });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "LIST_FAILED" });
  }
}
