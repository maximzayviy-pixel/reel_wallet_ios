// pages/exchange.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";

type Gift = {
  id: string;
  title: string;
  priceStars: number; // для бота/списания, цену показываем на гифке
  image: string;
  limited: boolean;
  source?: string;
};

// Заглушки из последних ссылок пользователя
const SEED_GIFTS: Gift[] = [
  { id: "gift-15-1", title: "GIF #PMk6pII", priceStars: 15, image: "https://i.imgur.com/PMk6pII.gif", limited: false, source: "https://i.imgur.com/PMk6pII.gif" },
  { id: "gift-25-1", title: "GIF #ezgif-818ad7", priceStars: 25, image: "https://s8.ezgif.com/tmp/ezgif-818ad74ad3574c.gif", limited: false, source: "https8.ezgif.com/tmp/ezgif-818ad74ad3574c.gif" },
  { id: "gift-50-1", title: "GIF #XGDxTsb", priceStars: 50, image: "https://i.imgur.com/XGDxTsb.gif", limited: false, source: "https://i.imgur.com/XGDxTsb.gif" },
  { id: "gift-50-2", title: "GIF #l3Bb0Jd", priceStars: 50, image: "https://i.imgur.com/l3Bb0Jd.gif", limited: false, source: "https://i.imgur.com/l3Bb0Jd.gif" },
  { id: "gift-100-1", title: "GIF #WI774v0", priceStars: 100, image: "https://i.imgur.com/WI774v0.gif", limited: false, source: "https://i.imgur.com/WI774v0.gif" },
  { id: "gift-50-3", title: "GIF #1ZuCktd", priceStars: 50, image: "https://i.imgur.com/1ZuCktd.gif", limited: false, source: "https://i.imgur.com/1ZuCktd.gif" },
];

export default function Exchange() {
  const [query, setQuery] = useState("");
  const [onlyUnlimited, setOnlyUnlimited] = useState(true);
  const [gifts, setGifts] = useState<Gift[]>(SEED_GIFTS);
  const [loading, setLoading] = useState(false);
  const [showGate, setShowGate] = useState(true); // модалка «раздел в разработке»
  const [ack, setAck] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);

  // Если позже подключишь API — тут можно обновлять список
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/gifts");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) setGifts(data);
        }
      } catch (_) {
        // остаёмся на заглушках
      } finally {
        setLoading(false);
      }
    };
    // load(); // пока выключено
  }, []);

  const filtered = useMemo(() => {
    return gifts
      .filter((g) => (onlyUnlimited ? !g.limited : true))
      .filter((g) =>
        query.trim()
          ? g.title.toLowerCase().includes(query.trim().toLowerCase()) || g.id.toLowerCase().includes(query.trim().toLowerCase())
          : true
      );
  }, [gifts, onlyUnlimited, query]);

  const handleBuy = (giftId: string, price: number) => {
    window.open("https://t.me/ReelWalet?start=" + encodeURIComponent(`${giftId}-${price}`), "_blank");
  };

  const scrollByCards = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLDivElement>("[data-card]");
    const step = card ? card.getBoundingClientRect().width + 16 : 320; // +gap
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <Layout title="Обмен">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(60%_60%_at_50%_30%,#000_40%,transparent_100%)]"
          >
            <div className="absolute -top-8 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-sky-100 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-72 w-72 rounded-full bg-emerald-100 blur-3xl" />
          </div>

          <div className="relative p-6 sm:p-10">
            {/* Top bar */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Нелимитированные подарки</h1>
                <p className="text-slate-600 text-sm sm:text-base">Покупайте и дарите — передача через бота/админа.</p>
              </div>
              <div className="flex gap-3 items-center">
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 select-none">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={onlyUnlimited} onChange={(e) => setOnlyUnlimited(e.target.checked)} />
                  Только нелимитированные
                </label>
              </div>
            </div>

            {/* Search */}
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Поиск подарка (название или id)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <a
                href="https://t.me/ReelWalet"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Нужна помощь?
              </a>
            </div>

            {/* Carousel */}
            <div className="mt-6 relative">
              {/* Arrows */}
              <button
                type="button"
                onClick={() => scrollByCards(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-white shadow ring-1 ring-slate-200 hover:bg-slate-50"
                aria-label="Назад"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => scrollByCards(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-white shadow ring-1 ring-slate-200 hover:bg-slate-50"
                aria-label="Вперёд"
              >
                ›
              </button>

              <div
                ref={scrollerRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2"
              >
                {loading && <div className="text-sm text-slate-500">Загружаем актуальный список…</div>}
                {!loading && filtered.length === 0 && <div className="text-sm text-slate-500">Ничего не найдено.</div>}

                {filtered.map((g) => (
                  <div
                    key={g.id}
                    data-card
                    className="snap-start min-w-[260px] sm:min-w-[300px] rounded-2xl ring-1 ring-slate-200 bg-white overflow-hidden"
                  >
                    <div className="relative aspect-[2/3] bg-slate-50">{/* портрет, обрезка по бокам */}
                      <a href={g.source || g.image} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.image} alt={g.title} className="h-full w-full object-cover object-center" />
                      </a>
                      {g.limited && (
                        <span className="absolute top-2 left-2 rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-200 px-2 py-0.5 text-[11px] font-medium">
                          Лимитированный
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900 leading-tight">{g.title}</div>
                          <div className="text-xs text-slate-500">id: {g.id}</div>
                        </div>
                        <div className="text-xs text-slate-500 whitespace-nowrap">Цена на гифке</div>
                      </div>
                      <button
                        onClick={() => handleBuy(g.id, g.priceStars)}
                        className="mt-3 w-full rounded-xl bg-slate-900 text-white text-sm font-semibold py-2.5 hover:bg-slate-800"
                      >
                        Подарить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Note */}
            <p className="mt-6 text-[11px] text-slate-400 text-center">
              Список обновляется. Цены указаны на гифках; поле цены используется ботом для списания.
            </p>
          </div>
        </div>
      </div>

      {/* Gate modal */}
      {showGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-slate-100 p-6">
            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium bg-amber-50 ring-1 ring-amber-200 rounded-xl px-3 py-1 w-max">🚧 Раздел в разработке</div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">Могут встречаться ошибки</h2>
            <p className="mt-2 text-sm text-slate-600">Продолжая, вы понимаете, что каталог подарков может работать нестабильно. Сообщайте о багах администратору.</p>

            <label className="mt-4 flex items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>Я понял(а) и хочу продолжить</span>
            </label>

            <div className="mt-5 flex justify-end">
              <button
                disabled={!ack}
                onClick={() => setShowGate(false)}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed bg-slate-900 hover:bg-slate-800"
              >
                Продолжить
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
