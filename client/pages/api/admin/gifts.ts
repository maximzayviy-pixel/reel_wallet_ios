import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_guard";

// Парсим превью из t.me/nft/...: og:image / og:video / <video src> / <source src>
async function fetchGiftPreview(link: string) {
  const r = await fetch(link, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
  });
  const html = await r.text();
  const pick = (re: RegExp) => (html.match(re)?.[1] ?? "").trim();

  const ogImage =
    pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i);

  const ogVideo =
    pick(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+name=["']twitter:player["'][^>]+content=["']([^"']+)["']/i);

  const videoTag = pick(/<video[^>]+src=["']([^"']+)["']/i);
  const sourceTag = pick(/<source[^>]+src=["']([^"']+)["'][^>]*>/i);

  const image_url = ogImage || "";
  const anim_url = ogVideo || videoTag || sourceTag || "";

  return {
    image_url: image_url || null,
    anim_url: anim_url || null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  if (req.method === "GET") {
    const { data, error } = await supabase.from("gifts").select("*").order("id", { ascending: false });
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.json({ ok: true, items: data });
  }

  if (req.method === "POST") {
    const { link, price_rub, image_url, anim_url, enabled = true, title } = req.body || {};
    if (!link || !price_rub) return res.status(400).json({ ok: false, error: "link_and_price_required" });

    const m = String(link).match(/nft\/([A-Za-z0-9_]+)-(\d+)/);
    if (!m) return res.status(400).json({ ok: false, error: "invalid_link" });
    const slug = m[1];
    const number = Number(m[2]);

    let parsed = { image_url: image_url || null, anim_url: anim_url || null };
    if (!image_url || !anim_url) {
      try {
        const got = await fetchGiftPreview(link);
        parsed.image_url = parsed.image_url || got.image_url;
        parsed.anim_url = parsed.anim_url || got.anim_url;
      } catch {
        // оставим без превью
      }
    }

    const { error } = await supabase.from("gifts").insert({
      title: title || slug,
      slug,
      number,
      price_rub,
      image_url: parsed.image_url,
      anim_url: parsed.anim_url,
      enabled,
    });
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.json({ ok: true });
  }

  if (req.method === "PUT") {
    const { id, ...rest } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: "id_required" });
    const { error } = await supabase.from("gifts").update(rest).eq("id", id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ ok: false, error: "id_required" });
    const { error } = await supabase.from("gifts").delete().eq("id", id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.json({ ok: true });
  }

  res.setHeader("Allow", "GET,POST,PUT,DELETE");
  res.status(405).end();
}
