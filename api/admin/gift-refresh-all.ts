// pages/api/admin/gift-refresh-all.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// простой доступ по заголовку X-Admin-Key (для браузера) + через мини-апп уже есть guard
const ADMIN_HTTP_KEY = process.env.ADMIN_HTTP_KEY || process.env.CRON_SECRET || "";

function ok(res: NextApiResponse, data: any) { return res.status(200).json(data); }
function bad(res: NextApiResponse, msg: string, code = 400) { return res.status(code).json({ error: msg }); }

function textClean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

// безопасный матчер (без флага /s — совместим со старым es)
function m(html: string, re: RegExp) {
  const mm = re.exec(html);
  return mm ? mm[1] : null;
}

// собираем пары «имя → значение» из таблички характеристик
function parseStats(html: string) {
  const pairs: Array<[string, string]> = [];
  const re = /<div[^>]*class=["'][^"']*tgme_gift_stats_name[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class=["'][^"']*tgme_gift_stats_value[^"']*["'][^>]*>([\s\S]*?)<\/div>/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(html))) pairs.push([textClean(mm[1]).toLowerCase(), textClean(mm[2])]);
  const dict: Record<string, string> = {};
  for (const [k, v] of pairs) dict[k] = v;
  return dict;
}

// вынимаем полный <svg ...>...</svg> из блока превью (тот самый фон из Telegram)
function extractPreviewSvg(html: string) {
  const reBlock = /<div[^>]*class=['"][^'"]*tgme_gift_preview[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i;
  const block = m(html, reBlock);
  if (!block) return null;
  const svg = m(block, /<svg[\s\S]*?<\/svg>/i);
  if (!svg) return null;
  // data-URI, чтобы можно было подставлять как background-image
  const uri = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  return uri;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return bad(res, "Method Not Allowed", 405);
  const adminKey = (req.headers["x-admin-key"] as string) || (req.query.key as string) || "";
  if (!ADMIN_HTTP_KEY || adminKey !== ADMIN_HTTP_KEY) return bad(res, "FORBIDDEN: bad admin key", 401);

  // берём все активные подарки (enabled = true, если такое поле есть; иначе всё)
  const { data: list, error } = await supabaseAdmin
    .from("gifts")
    .select("id,title,slug,number,tme_link")
    .order("id", { ascending: true });

  if (error) return bad(res, error.message, 500);

  const updated: number[] = [];

  for (const g of list || []) {
    try {
      const url = g.tme_link || `https://t.me/nft/${g.slug}-${g.number}`;
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (gift-refresher)" } });
      const html = await r.text();

      // .tgs (анимация)
      const tgs_url =
        m(html, /<source[^>]+type=["']application\/x-tgsticker["'][^>]+srcset=["']([^"']+)["']/i) || null;

      // постер (og:image)
      const poster =
        m(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || null;

      // характеристики
      const stats = parseStats(html);
      const model    = stats["модель"] || stats["model"] || null;
      const backdrop = stats["фон"]    || stats["backdrop"] || null;
      const pattern  = stats["узор"]   || stats["pattern"] || null;

      // «Ценность ~ 1 974,00 RUB» → число
      let value_rub: number | null = null;
      const valueStr = (stats["ценность"] || stats["value"] || "").replace(/[^\d,.\s]/g, "").replace(",", ".");
      if (valueStr) {
        const num = parseFloat(valueStr);
        if (!Number.isNaN(num)) value_rub = Math.round(num);
      }

      // Выпущено / Всего: "158 110 / 173 176"
      let amount_issued: number | null = null;
      let amount_total: number | null = null;
      const qty = (stats["количество"] || stats["выпущено / всего"] || "").match(/([\d\s]+)[^\d]+([\d\s]+)/);
      if (qty) {
        amount_issued = parseInt(qty[1].replace(/\s/g, ""), 10);
        amount_total  = parseInt(qty[2].replace(/\s/g, ""), 10);
      }

      // тот самый SVG-фон
      const preview_svg = extractPreviewSvg(html);

      const upd = await supabaseAdmin
        .from("gifts")
        .update({
          tgs_url,
          image_url: poster,
          preview_svg,
          model,
          backdrop,
          pattern,
          value_rub,
          amount_issued,
          amount_total,
        })
        .eq("id", g.id);

      if (!upd.error) updated.push(g.id);
    } catch (e) {
      // глушим, чтобы проскакать все карточки
    }
  }

  return ok(res, { ok: true, updated });
}
