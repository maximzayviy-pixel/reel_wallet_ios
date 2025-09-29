// client/pages/api/sbp-banks.ts
import type { NextApiRequest, NextApiResponse } from "next";

type Bank = { name: string; logo: string };

let CACHE: { ts: number; items: Bank[] } | null = null;
const ONE_DAY = 24 * 60 * 60 * 1000;

const FALLBACK: Bank[] = [
  { name: "Сбербанк", logo: "https://upload.wikimedia.org/wikipedia/commons/1/16/Sberbank_Logo_2020_Russian.svg" },
  { name: "Тинькофф", logo: "https://static.tinkoff.ru/logos/main-logo.svg" },
  { name: "ВТБ", logo: "https://upload.wikimedia.org/wikipedia/commons/1/1d/VTB_logo_ru.svg" },
  { name: "Альфа-Банк", logo: "https://upload.wikimedia.org/wikipedia/commons/6/60/Logo_Alfa-Bank.svg" },
];

async function fetchBanks(): Promise<Bank[]> {
  const url = "https://sbp.nspk.ru/participants?type=person";
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("NSPK fetch failed");
  const html = await res.text();

  // Поиск блоков вида <img ... src="..." alt="Банк ...">
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*alt="([^"]+?)"[^>]*>/gi;
  const items: Bank[] = [];
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(html))) {
    const src = m[1];
    const alt = m[2].trim();
    // Простой фильтр «здравого смысла»: пропустим явно нерелевантные картинки
    if (/logo|bank|банк|png|svg|jpg|jpeg/i.test(src) && !/sprite|icon|apple-touch/i.test(src)) {
      const logo = src.startsWith("http") ? src : `https://sbp.nspk.ru${src}`;
      items.push({ name: alt, logo });
    }
  }

  // Нормализуем и уберём дубликаты
  const map = new Map<string, Bank>();
  for (const b of items) {
    const key = b.name.toLowerCase().replace(/\s+/g, " ").trim();
    if (!map.has(key)) map.set(key, b);
  }
  const out = Array.from(map.values());
  return out.length ? out : FALLBACK;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (CACHE && Date.now() - CACHE.ts < ONE_DAY) {
      return res.status(200).json({ ok: true, items: CACHE.items });
    }
    const items = await fetchBanks();
    CACHE = { ts: Date.now(), items };
    res.status(200).json({ ok: true, items });
  } catch {
    res.status(200).json({ ok: true, items: FALLBACK, cached: true });
  }
}
