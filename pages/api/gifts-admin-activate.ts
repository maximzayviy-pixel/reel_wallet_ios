import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const auth = (req.headers.authorization || "").split("Bearer ").pop();
  if (!auth || auth !== process.env.INVOICE_SECRET) return res.status(401).json({ error: "unauthorized" });
  const { listing_id } = req.body || {};
  if (!listing_id) return res.status(400).json({ error: "listing_id required" });
  const { data, error } = await supabase.from("gift_listings").update({ status: "active" }).eq("id", listing_id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, listing: data });
}
