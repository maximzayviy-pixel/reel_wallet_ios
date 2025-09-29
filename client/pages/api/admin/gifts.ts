import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_guard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  if (req.method === "GET") {
    const { data, error } = await supabase.from('gifts').select('*').order('id', { ascending: false });
    if (error) return res.status(500).json({ ok:false, error: error.message });
    return res.json({ ok:true, items: data });
  }

  if (req.method === "POST") {
    const { link, price_rub, image_url, enabled = true, title } = req.body || {};
    if (!link || !price_rub) return res.status(400).json({ ok:false, error: "link_and_price_required" });
    // link like https://t.me/nft/EasterEgg-115089
    const m = String(link).match(/nft\/([A-Za-z0-9_]+)-(\d+)/);
    if (!m) return res.status(400).json({ ok:false, error: "invalid_link" });
    const slug = m[1], number = Number(m[2]);
    const { error } = await supabase.from('gifts').insert({ title: title || slug, slug, number, price_rub, image_url, enabled });
    if (error) return res.status(500).json({ ok:false, error: error.message });
    return res.json({ ok:true });
  }

  if (req.method === "PUT") {
    const { id, ...rest } = req.body || {};
    if (!id) return res.status(400).json({ ok:false, error: "id_required" });
    const { error } = await supabase.from('gifts').update(rest).eq('id', id);
    if (error) return res.status(500).json({ ok:false, error: error.message });
    return res.json({ ok:true });
  }

  if (req.method === "DELETE") {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ ok:false, error: "id_required" });
    const { error } = await supabase.from('gifts').delete().eq('id', id);
    if (error) return res.status(500).json({ ok:false, error: error.message });
    return res.json({ ok:true });
  }

  res.setHeader("Allow", "GET,POST,PUT,DELETE");
  res.status(405).end();
}
