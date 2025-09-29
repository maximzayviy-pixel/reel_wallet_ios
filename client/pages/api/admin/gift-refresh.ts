// pages/api/admin/gift-refresh.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_guard";

/** helpers */
const CLEAN_TAGS = /<[^>]*>/g;
const NBSP = /\u00A0/g;

function textClean(s: string) {
  return s.replace(CLEAN_TAGS, "").replace(NBSP, " ").trim();
}
function take(html: string, re: RegExp) {
  const m = html.match(re);
  return m ? m[1] : "";
}
function toNumber(s?: string | null) {
  if (!s) return null;
  const norm = s.replace(/\s|\u00A0/g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}
function numbersFrom(text: string) {
  const arr = Array.from(text.replace(NBSP, " ").matchAll(/([\d\s.,]+)/g)).map(m =>
    (m[1] || "").replace(/\s|\u00A0/g, "").replace(",", ".")
  );
  return arr.map(x => Number(x)).filter(n => Number.isFinite(n));
}

/** универсальный разбор таблички характеристик */
function parseStats(html: string) {
  const pairs: Array<[string, string]> = [];
  const re = /<div[^>]*class=["'][^"']*tgme_gift_stats_name[^"']*["'][^>]*>(.*?)<\/div>\s*<div[^>]*class=["'][^"']*tgme_gift_stats_value[^"']*["'][^>]*>(.*?)<\/div>/gsi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const name = textClean(m[1]).toLowerCase();
    const val = textClean(m[2]);
    if (name && val) pairs.push([name, val]);
  }

  let model: string | null = null;
  let backdrop: string | null = null;
  let pattern: string | null = null;
  let amount_total: number | null = null;
  let amount_issued: number | null = null;
  let value_rub: number | null = null;

  for (const [name, val] of pairs) {
    if (/^(модель|model)$/.test(name)) model = val;
    else if (/^(фон|background|backdrop)$/.test(name)) backdrop = val;
    else if (/^(узор|pattern)$/.test(name)) pattern = val;
    else if (/^(количество|amount)$/.test(name)) {
      const nums = numbersFrom(val);
      if (nums.length >= 1) amount_total = nums[0];
      if (nums.length >= 2) amount_issued = nums[1];
      // если в тексте есть "выпущено/issued" и одно число — считаем это issued
      if (nums.length === 1 && /(выпущено|issued)/i.test(val)) {
        amount_issued = nums[0];
      }
    } else if (/^(ценность|value)$/.test(name) || /RUB/i.test(val)) {
      // иногда "Value" стоит как name, иногда как value со словом RUB
      const n = toNumber((val.match(/([\d\s.,]+)\s*RUB/i) || [])[1] ?? val);
      if (n != null) value_rub = n;
    }
  }

  // запасной парс «Ценность ~ … RUB» из всего HTML (на случай другой вёрстки)
  if (value_rub == null) {
    const vRaw =
      take(html, /Ценность[^~]*~\s*([\d\s.,]+)\s*RUB/i) ||
      take(html, /Value[^~]*~\s*([\d\s.,]+)\s*RUB/i);
    value_rub = toNumber(vRaw);
  }

  return { model, backdrop, pattern, amount_total, amount_issued, value_rub };
}

/** парс ссылок на постер/анимку/стикер */
function parseMedia(html: string) {
  const image =
    take(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    take(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
    take(html, /<img[^>]+class=["'][^"']*tgme_gift_model[^"']*["'][^>]+src=["']([^"']+)["']/i);

  const video =
    take(html, /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i) ||
    take(html, /<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)["']/i) ||
    take(html, /<video[^>]+src=["']([^"']+)["']/i) ||
    take(html, /<source[^>]+src=["']([^"']+)["'][^>]*>/i);

  const tgs =
    take(html, /<source[^>]+type=["']application\/x-tgsticker["'][^>]+srcset=["']([^"']+)["']/i) ||
    take(html, /<source[^>]+type=["']application\/x-tgsticker["'][^>]+src=["']([^"']+)["']/i);

  return {
    image_url: image || null,
    anim_url: video || null,
    tgs_url: tgs || null,
  };
}

async function fetchGift(link: string) {
  const r = await fetch(link, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  const html = await r.text();
  return { ...parseMedia(html), ...parseStats(html) };
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

  const parsed = await fetchGift(gift.tme_link);
  const { error: uErr } = await supabase.from("gifts").update(parsed).eq("id", id);
  if (uErr) return res.status(500).json({ ok: false, error: uErr.message });

  res.json({ ok: true, ...parsed });
}
