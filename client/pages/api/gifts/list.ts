// pages/api/gifts/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const { data, error } = await supabaseAdmin
    .from("gifts")
    .select("id,title,slug,number,tme_link,price_rub,value_rub,image_url,tgs_url,anim_url,model,backdrop,pattern,amount_issued,amount_total,preview_svg")
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.json({ ok: true, items: data || [] });
}
