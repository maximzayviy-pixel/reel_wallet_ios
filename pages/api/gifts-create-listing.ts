import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { title, price_stars, quantity, media_url, seller_tg_id } = req.body || {};
  if (!title || !price_stars || !quantity || !seller_tg_id) return res.status(400).json({ error: "title, price_stars, quantity, seller_tg_id required" });
  const { data, error } = await supabase.from("gift_listings").insert([{
    title, price_stars: Number(price_stars), quantity: Number(quantity), media_url: media_url || null, seller_tg_id, status: "pending"
  }]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, listing: data });
}
