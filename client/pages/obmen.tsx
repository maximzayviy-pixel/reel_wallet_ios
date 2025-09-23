// pages/exchange.tsx
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";

// Пример источника данных. В проде лучше отдавать JSON из /api/gifts
// со свежими данными и флагом limited: boolean
// Здесь заполнено несколько популярных НЕлимитированных примеров как заглушка.
// Поля: id, title, priceStars, image, limited
const SEED_GIFTS = [
  {
    id: "gift-15-1",
    title: "GIF #PMk6pII",
    priceStars: 15,
    image: "https://i.imgur.com/PMk6pII.gif",
    limited: false,
    source: "https://i.imgur.com/PMk6pII.gif",
  },
  {
    id: "gift-25-1",
    title: "GIF #ezgif-818ad7",
    priceStars: 25,
    image: "https://s8.ezgif.com/tmp/ezgif-818ad74ad3574c.gif",
    limited: false,
    source: "https://s8.ezgif.com/tmp/ezgif-818ad74ad3574c.gif",
  },
  {
    id: "gift-50-1",
    title: "GIF #XGDxTsb",
    priceStars: 50,
    image: "https://i.imgur.com/XGDxTsb.gif",
    limited: false,
    source: "https://i.imgur.com/XGDxTsb.gif",
  },
  {
    id: "gift-50-2",
    title: "GIF #l3Bb0Jd",
    priceStars: 50,
    image: "https://i.imgur.com/l3Bb0Jd.gif",
    limited: false,
    source: "https://i.imgur.com/l3Bb0Jd.gif",
  },
  {
    id: "gift-100-1",
    title: "GIF #WI774v0",
    priceStars: 100,
    image: "https://i.imgur.com/WI774v0.gif",
    limited: false,
    source: "https://i.imgur.com/WI774v0.gif",
  },
  {
    id: "gift-50-3",
    title: "GIF #1ZuCktd",
    priceStars: 50,
    image: "https://i.imgur.com/1ZuCktd.gif",
    limited: false,
    source: "https://i.imgur.com/1ZuCktd.gif",
  },
];

export default function Exchange() {
  const [query, setQuery] = useState("");
  const [onlyUnlimited, setOnlyUnlimited] = useState(true);
  const [gifts, setGifts] = useState(SEED_GIFTS);
  const [loading, setLoading] = useState(false);

  // Попытка подтянуть актуальный список с вашего API (если появится)
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/gifts");
        if (res.ok) {
          const data = await res.json();
          // ожидается массив { id, title, priceStars, image, limited }
          if (Array.isArray(data) && data.length) setGifts(data);
        }
      } catch (_) {
        // остаёмся на SEED_GIFTS
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return gifts
      .filter((g) => (onlyUnlimited ? !g.limited : true))
      .filter((g) =>
        query.trim()
          ? g.title.toLowerCase().includes(query.trim().toLowerCase()) ||
            g.id.toLowerCase().includes(query.trim().toLowerCase())
          : true
      );
  }, [gifts, onlyUnlimited, query]);

  const handleBuy = (giftId: string, price: number) => {
    // Вариант: писать админу/боту со старт-параметрами (id и цена)
    window.open("https://t.me/ReelWalet?start=" + encodeURIComponent(`${giftId}-${price}`), "_blank");
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
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                  Нелимитированные подарки Telegram
                </h1>
                <p className="text-slate-600 text-sm sm:text-base">
                  Покупайте подарки за ⭐ звёзды — бот или админ передаст их получателю.
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={onlyUnlimited}
                    onChange={(e) => setOnlyUnlimited(e.target.checked)}
                  />
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

            {/* Grid */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading && (
                <div className="col-span-full text-sm text-slate-500">Загружаем актуальный список…</div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="col-span-full text-sm text-slate-500">Ничего не найдено.</div>
              )}

              {filtered.map((g) => (
                <div key={g.id} className="group rounded-2xl ring-1 ring-slate-200 bg-white overflow-hidden">
                  <div className="relative aspect-[4/3] bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <a href={g.source || g.image} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.image} alt={g.title} className="h-full w-full object-cover" />
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
                      Купить и передать
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Note */}
            <p className="mt-6 text-[11px] text-slate-400 text-center">
              Список обновляется. Цены указаны ориентировочно; итоговая стоимость в ⭐ может отличаться на момент покупки.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
