// pages/api/admin/gift-refresh.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_guard";

function take(html: string, re: RegExp) {
  const m = html.match(re);
  return m ? m[1].trim() : "";
}
function toNumber(s?: string | null) {
  if (!s) return null;
  const norm = s.replace(/\u00A0|\s/g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

async function fetchGiftPreview(link: string) {
  const r = await fetch(link, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  const html = await r.text();

  // источники превью
  const image =
    take(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    take(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);

  const video =
    take(html, /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i) ||
    take(html, /<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)["']/i) ||
    take(html, /<video[^>]+src=["']([^"']+)["']/i) ||
    take(html, /<source[^>]+src=["']([^"']+)["'][^>]*>/i);

  const tgs =
    take(html, /<source[^>]+type=["']application\/x-tgsticker["'][^>]+srcset=["']([^"']+)["']/i) ||
    take(html, /<source[^>]+type=["']application\/x-tgsticker["'][^>]+src=["']([^"']+)["']/i);

  // «Ценность ~ 1 974,00 RUB» / "Value ~ 23.45 RUB"
  const valueRaw =
    take(html, /Ценность[^~]*~\s*([\d\s.,]+)\s*RUB/i) ||
    take(html, /Value[^~]*~\s*([\d\s.,]+)\s*RUB/i);
  const value_rub = toNumber(valueRaw);

  // характеристики (ru/en)
  const model =
    take(html, /tgme_gift_stats_name[^>]*>\s*Модель\s*<\/div>\s*<div[^>]*tgme_gift_stats_value[^>]*>([^<]+)/i) ||
    take(html, /tgme_gift_stats_name[^>]*>\s*Model\s*<\/div>\s*<div[^>]*tgme_gift_stats_value[^>]*>([^<]+)/i);

  const backdrop =
    take(html, /tgme_gift_stats_name[^>]*>\s*Фон\s*<\/div>\s*<div[^>]*tgme_gift_stats_value[^>]*>([^<]+)/i) ||
    take(html, /tgme_gift_stats_name[^>]*>\s*(Background|Backdrop)\s*<\/div>\s*<div[^>]*tgme_gift_stats_value[^>]*>([^<]+)/i);

  const pattern =
    take(html, /tgme_gift_stats_name[^>]*>\s*Узор\s*<\/div>\s*<div[^>]*tgme_gift_stats_value[^>]*>([^<]+)/i) ||
    take(html, /tgme_gift_stats_name[^>]*>\s*Pattern\s*<\/div>\s*<div[^>]*tgme_gift_stats_value[^>]*>([^<]+)/i);

  // Количество (всего) и выпущено
  const amountTotalRaw =
    take(html, /Количество[^<]*<\/div>\s*<div[^>]*tgme_gift_stats_value[^>]*>\s*([\d\s.,]+)/i) ||
    take(html, /Amount[^<]*<\/div>\s*<div[^>]*tgme_gift_stats_value[^>]*>\s*([\d\s.,]+)/i);
  const amountIssuedRaw =
    take(html, /выпущено\s*([\d\s.,]+)/i) || take(html, /issued\s*([\d\s.,]+)/i);

  const amount_total = toNumber(amountTotalRaw);
  const amount_issued = toNumber(amountIssuedRaw);

  return {
    image_url: image || null,
    anim_url: video || null,
    tgs_url: tgs || null,
    value_rub,
    model: model || null,
    backdrop: backdrop || null,
    pattern: pattern || null,
    amount_total,
    amount_issued,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== "POST") return res.status(405).end();

  const id = Number(req.body?.id);
  if (!id) return res.status(400).json({ ok: false, error: "id_required" });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { data: gift, error } = await supabase
    .from("gifts")
    .select("id,tme_link")
    .eq("id", id)
    .maybeSingle();

  if (error || !gift) return res.status(404).json({ ok: false, error: "gift_not_found" });

  const parsed = await fetchGiftPreview(gift.tme_link);
  const { error: uErr } = await supabase.from("gifts").update(parsed).eq("id", id);
  if (uErr) return res.status(500).json({ ok: false, error: uErr.message });

  res.json({ ok: true, ...parsed });
}
