// pages/api/admin/gift-refresh-all.ts — refresh previews for all gifts missing urls
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_guard";

function pick(html: string, re: RegExp) { return (html.match(re)?.[1] ?? "").trim(); }
async function fetchGiftPreview(link: string) {
  const r = await fetch(link, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36" }
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
  const tgs =
    pick(html, /<source[^>]+type=["']application\/x-tgsticker["'][^>]+srcset=["']([^"']+)["']/i) || "";
  return { image_url: image || null, anim_url: video || null, tgs_url: tgs || null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== "POST") return res.status(405).end();

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  // забираем все, у кого не заполнено одно из полей
  const { data: gifts, error } = await supabase
    .from("gifts")
    .select("id,tme_link,image_url,anim_url,tgs_url")
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ ok: false, error: error.message });

  const updated: Array<{ id: number; ok: boolean; reason?: string }> = [];
  for (const g of gifts || []) {
    if (g.image_url && g.tgs_url && g.anim_url) continue;
    try {
      const parsed = await fetchGiftPreview(g.tme_link);
      await supabase.from("gifts").update(parsed).eq("id", g.id);
      updated.push({ id: g.id, ok: true });
      // маленькая пауза, чтобы не спамить
      await new Promise((r) => setTimeout(r, 200));
    } catch (e: any) {
      updated.push({ id: g.id, ok: false, reason: e?.message || "parse_failed" });
    }
  }

  res.json({ ok: true, updated });
}
