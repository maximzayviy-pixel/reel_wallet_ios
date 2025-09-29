import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_guard";

// берём ровно ту же функцию fetchGiftPreview, что выше
async function fetchGiftPreview(link: string) {
  const r = await fetch(link, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en;q=0.9,ru;q=0.8",
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
  return { image_url: image_url || null, anim_url: anim_url || null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== "POST") return res.status(405).end();

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const id = Number(req.body?.id);
  if (!id) return res.status(400).json({ ok: false, error: "id_required" });

  const { data: gift, error } = await supabase.from("gifts").select("id,tme_link").eq("id", id).maybeSingle();
  if (error || !gift) return res.status(404).json({ ok: false, error: "gift_not_found" });

  const prev = await fetchGiftPreview(gift.tme_link);
  await supabase.from("gifts").update(prev).eq("id", id);

  res.json({ ok: true, ...prev });
}
