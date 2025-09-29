// pages/api/admin/gift-refresh-all.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_guard";

/* ----------------------- helpers ----------------------- */
const CLEAN_TAGS = /<[^>]*>/g;
const NBSP = /\u00A0/g;

const textClean = (s: string) => s.replace(CLEAN_TAGS, "").replace(NBSP, " ").trim();
const take = (html: string, re: RegExp) => html.match(re)?.[1] ?? "";
const toNumber = (s?: string | null) => {
  if (!s) return null;
  const norm = s.replace(/\s|\u00A0/g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
};
const numbersFrom = (text: string) =>
  Array.from(text.replace(NBSP, " ").matchAll(/([\d\s.,]+)/g))
    .map((m) => (m[1] || "").replace(/\s|\u00A0/g, "").replace(",", "."))
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));

function parseStats(html: string) {
  let model: string | null = null;
  let backdrop: string | null = null;
  let pattern: string | null = null;
  let amount_total: number | null = null;
  let amount_issued: number | null = null;
  let value_rub: number | null = null;

  // 1) богатая таблица name/value
  {
    const re = new RegExp(
      '<div[^>]*class=["\'][^"\']*tgme_gift_stats_name[^"\']*["\'][^>]*>([\\s\\S]*?)<\\/div>\\s*<div[^>]*class=["\'][^"\']*tgme_gift_stats_value[^"\']*["\'][^>]*>([\\s\\S]*?)<\\/div>',
      "gi"
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const name = textClean(m[1]).toLowerCase();
      const val = textClean(m[2]);
      if (!name || !val) continue;

      if (/^(модель|model)$/.test(name)) model = val;
      else if (/^(фон|background|backdrop)$/.test(name)) backdrop = val;
      else if (/^(узор|pattern|symbol)$/.test(name)) pattern = val;
      else if (/^(количество|amount|quantity)$/.test(name)) {
        const nums = numbersFrom(val);
        if (nums.length >= 2) {
          amount_issued = nums[0];
          amount_total  = nums[1];
        } else if (nums.length === 1) {
          if (/(выпущено|issued)/i.test(val)) amount_issued = nums[0];
          else amount_total = nums[0];
        }
      } else if (/^(ценность|value)$/.test(name) || /RUB/i.test(val)) {
        const n = toNumber((val.match(/([\d\s.,]+)\s*RUB/i) || [])[1] ?? val);
        if (n != null) value_rub = n;
      }
    }
  }

  // 2) упрощённая текстовая версия
  const plain = html
    .replace(/\r/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!model) {
    const m = plain.match(/\bModel\s+([^\n]+?)(?:\s+\d+(\.\d+)?%|\s*$)/i);
    if (m) model = m[1].trim();
  }
  if (!backdrop) {
    const m = plain.match(/\b(Backdrop|Background)\s+([^\n]+?)(?:\s+\d+(\.\d+)?%|\s*$)/i);
    if (m) backdrop = m[2].trim();
  }
  if (!pattern) {
    const m = plain.match(/\b(Symbol|Pattern)\s+([^\n]+?)(?:\s+\d+(\.\d+)?%|\s*$)/i);
    if (m) pattern = m[2].trim();
  }
  if (amount_total == null || amount_issued == null) {
    const q = plain.match(/\bQuantity\s+([\d\s.,]+)\s*\/\s*([\d\s.,]+)\s+issued/i);
    if (q) {
      const issued = Number(q[1].replace(/\s|,/g, "").replace(",", "."));
      const total  = Number(q[2].replace(/\s|,/g, "").replace(",", "."));
      if (Number.isFinite(issued)) amount_issued = issued;
      if (Number.isFinite(total))  amount_total  = total;
    }
  }
  if (value_rub == null) {
    const v =
      plain.match(/Value[^~]*~\s*([\d\s.,]+)\s*RUB/i) ||
      plain.match(/Ценность[^~]*~\s*([\d\s.,]+)\s*RUB/i);
    if (v) {
      const n = Number(v[1].replace(/\s|,/g, "").replace(",", "."));
      if (Number.isFinite(n)) value_rub = n;
    }
  }

  return { model, backdrop, pattern, amount_total, amount_issued, value_rub };
}

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

  return { image_url: image || null, anim_url: video || null, tgs_url: tgs || null };
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

/* ----------------------- handler ----------------------- */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== "POST") return res.status(405).end();

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { data: gifts, error } = await supabase
    .from("gifts")
    .select("id,tme_link")
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ ok: false, error: error.message });

  const updated: Array<{ id: number; ok: boolean; error?: string }> = [];

  for (const g of gifts || []) {
    try {
      const parsed = await fetchGift(g.tme_link);
      const { error: uErr } = await supabase.from("gifts").update(parsed).eq("id", g.id);
      updated.push({ id: g.id, ok: !uErr, error: uErr?.message });
    } catch (e: any) {
      updated.push({ id: g.id, ok: false, error: e?.message || "parse_failed" });
    }
    // небольшой троттлинг
    await new Promise((r) => setTimeout(r, 150));
  }

  res.json({ ok: true, updated });
}
