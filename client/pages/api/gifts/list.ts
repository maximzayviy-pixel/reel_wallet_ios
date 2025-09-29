import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const limit = req.query?.limit ? parseInt(String(req.query.limit),10) : 60;
  const { data, error } = await supabase
    .from('gifts')
    .select('id,title,slug,number,tme_link,price_rub,image_url')
    .eq('enabled', true)
    .order('id', { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ ok:false, error: error.message });
  res.json({ ok:true, items: data });
}
