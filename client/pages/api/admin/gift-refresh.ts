// pages/api/admin/gift-refresh.ts — refresh preview (image/anim/tgs) for existing gift
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_guard";

function pick(html: string, re: RegExp) { return (html.match(re)?.[1] ?? "").trim(); }

async function fetchGiftPreview(link: string) {
  const r = await fetch(link, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en;q=0.9,ru;q=0.8"
    }
  });
  const html = await r.text();
  const image =
    pick(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    pick(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  const video =
    pick(html, /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i) ||
    pick(html, /<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)["']/i) ||
    pick(html, /<video[^>]+src=["']([^"']+)["']/i) ||
    pick(html, /<source[^>]+src=["']([^"']+)["'][^>]*>/i);
  // Telegram animated sticker (.tgs)
  const tgs =
    pick(html, /<source[^>]+type=["']application\/x-tgsticker["'][^>]+srcset=["']([^"']+)["']/i) || "";
  return { image_url: image || null, anim_url: video || null, tgs_url: tgs || null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== "POST") return res.status(405).end();

  const id = Number(req.body?.id);
  if (!id) return res.status(400).json({ ok: false, error: "id_required" });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { data: gift, error } = await supabase.from("gifts").select("id,tme_link").eq("id", id).maybeSingle();
  if (error || !gift) return res.status(404).json({ ok: false, error: "gift_not_found" });

  const prev = await fetchGiftPreview(gift.tme_link);
  const { error: uErr } = await supabase.from("gifts").update(prev).eq("id", id);
  if (uErr) return res.status(500).json({ ok: false, error: uErr.message });

  res.json({ ok: true, ...prev });
}
