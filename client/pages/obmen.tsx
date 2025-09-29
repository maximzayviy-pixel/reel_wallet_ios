// pages/obmen.tsx — вкладка «Обмен» c красивым фоном карточек
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StickerPlayer from "../components/StickerPlayer";

type Gift = {
  id: number;
  title: string;
  slug: string;
  number: number;
  tme_link: string;
  price_rub: number | null;
  value_rub: number | null;
  image_url: string | null;
  tgs_url: string | null;
  anim_url: string | null;
  model: string | null;
  backdrop: string | null; // напр. French Blue / Sky Blue
  pattern: string | null;  // напр. Star / Sushi Rolls
  amount_issued: number | null;
  amount_total: number | null;
};

// ---- helpers: красивый фон и паттерн ---------------------------------------

function colorsForBackdrop(name?: string | null) {
  const key = (name || "").toLowerCase();
  // пара (center, edge)
  if (key.includes("french")) return ["#cde8fd", "#07609b"];        // как в примере frog
  if (key.includes("sky"))    return ["#cde9ff", "#3f6fb1"];        // для Sky Blue
  if (key.includes("capuccino") || key.includes("cappuccino"))
    return ["#f3e6d7", "#b78c5a"];
  if (key.includes("pink"))   return ["#ffd6f1", "#b33aa0"];
  if (key.includes("green"))  return ["#d4f7e1", "#2a7d56"];
  return ["#e9eef8", "#7a8da8"]; // дефолт
}

function patternEmoji(name?: string | null) {
  const key = (name || "").toLowerCase();
  if (key.includes("star")) return "★";
  if (key.includes("roll")) return "🍣";
  if (key.includes("skull")) return "☠";
  if (key.includes("cherry")) return "🍒";
  if (key.includes("viper")) return "🐍";
  if (key.includes("meteor")) return "☄";
  return "✦";
}

function patternDataUri(emoji: string, color: string) {
  // маленький SVG с повторяющимся символом (низкая непрозрачность)
  const svg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
      <text x='20' y='45' font-size='28' fill='${color}' fill-opacity='0.18'>${emoji}</text>
    </svg>`
  );
  return `url("data:image/svg+xml,${svg}")`;
}

function cardBackgroundStyle(backdrop?: string | null, pattern?: string | null) {
  const [c0, c1] = colorsForBackdrop(backdrop);
  const pat = patternDataUri(patternEmoji(pattern), c1);
  return {
    backgroundImage: `radial-gradient(120% 120% at 50% 10%, ${c0} 0%, ${c1} 100%), ${pat}`,
    backgroundSize: `auto, 90px 90px`,
    backgroundPosition: `center, top left`,
    backgroundRepeat: `no-repeat, repeat`,
  } as React.CSSProperties;
}

// ---- страница ---------------------------------------------------------------

export default function Obmen() {
  const [items, setItems] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Gift | null>(null);
  const [buying, setBuying] = useState(false);

  // безопасный флаг баннера беты
  const [betaHidden, setBetaHidden] = useState<boolean>(true);
  useEffect(() => {
    try {
      const v = typeof window !== "undefined"
        ? window.sessionStorage.getItem("beta_banner_seen_v1")
        : "1";
      setBetaHidden(!!v);
    } catch { setBetaHidden(true); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/gifts/list");
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Ошибка загрузки");
        setItems(j.items);
      } catch (e: any) {
        setError(e?.message || "Ошибка сети");
      } finally { setLoading(false); }
    })();
  }, []);

  const buy = async (gift: Gift) => {
    setBuying(true);
    try {
      const r = await fetch("/api/gifts/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-init-data":
            (typeof window !== "undefined"
              ? (window as any)?.Telegram?.WebApp?.initData
              : "") || "",
        },
        body: JSON.stringify({ gift_id: gift.id }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Ошибка");
      window.open(j.tme_link || gift.tme_link, "_blank");
      alert("Покупка успешна! Ссылка на подарок открыта.");
    } catch (e: any) {
      alert("Не удалось купить: " + (e?.message || "Ошибка"));
    } finally { setBuying(false); }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";

  return (
    <Layout title="Обмен — подарки Telegram">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {!betaHidden && (
          <div className="mb-5 rounded-2xl border border-yellow-200 bg-yellow-50 text-yellow-900 p-4">
            <div className="font-semibold mb-1">Бета-версия магазина</div>
            <div className="text-sm opacity-90">
              Возможны баги и задержки загрузки превью.
            </div>
            <button
              onClick={() => {
                try { window.sessionStorage.setItem("beta_banner_seen_v1", "1"); } catch {}
                setBetaHidden(true);
              }}
              className="mt-3 inline-flex items-center rounded-xl bg-yellow-500 text-white px-4 py-2 hover:bg-yellow-600"
            >
              Окей
            </button>
          </div>
        )}

        {loading && <div className="text-slate-500">Загрузка…</div>}
        {error && (
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((g) => {
            const price = g.value_rub ?? g.price_rub ?? 0;
            return (
              <button
                key={g.id}
                onClick={() => setSelected(g)}
                className="group rounded-3xl bg-white ring-1 ring-slate-200 hover:ring-slate-300 transition p-3 text-left shadow-sm hover:shadow-md"
              >
                <div
                  className="relative aspect-square rounded-2xl overflow-hidden"
                  style={cardBackgroundStyle(g.backdrop, g.pattern)}
                >
                  {/* сама наклейка поверх фона */}
                  <div className="absolute inset-0 p-6 flex items-center justify-center">
                    <StickerPlayer
                      tgsUrl={g.tgs_url || undefined}
                      poster={g.image_url || undefined}
                      className="w-full h-full"
                    />
                  </div>
                </div>

                <div className="mt-2">
                  <div className="text-sm font-medium line-clamp-1">{g.title}</div>
                  <div className="text-[11px] text-slate-500">#{g.number}</div>
                  <div className="text-sm font-semibold mt-1 text-emerald-600">
                    {fmt(price)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Модалка */}
        {selected && (
          <div
            className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50"
            onClick={() => setSelected(null)}
          >
            <div
              className="bg-white rounded-3xl w-full sm:w-[560px] p-4 sm:p-6 m-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-4 items-start">
                <div
                  className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0"
                  style={cardBackgroundStyle(selected.backdrop, selected.pattern)}
                >
                  <div className="absolute inset-0 p-2 flex items-center justify-center">
                    <StickerPlayer
                      tgsUrl={selected.tgs_url || undefined}
                      poster={selected.image_url || undefined}
                      className="w-full h-full"
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <div className="font-semibold text-[17px] leading-5">
                    {selected.title}
                  </div>
                  <a
                    href={selected.tme_link}
                    target="_blank"
                    className="text-xs text-blue-600 underline"
                  >
                    Открыть в Telegram
                  </a>
                  <div className="text-2xl font-bold mt-1">
                    {fmt(selected.value_rub ?? selected.price_rub ?? 0)}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                    {selected.model && (
                      <div className="rounded-xl bg-slate-50 p-2">
                        <div className="text-slate-500">Модель</div>
                        <div className="font-medium">{selected.model}</div>
                      </div>
                    )}
                    {selected.backdrop && (
                      <div className="rounded-xl bg-slate-50 p-2">
                        <div className="text-slate-500">Фон</div>
                        <div className="font-medium">{selected.backdrop}</div>
                      </div>
                    )}
                    {selected.pattern && (
                      <div className="rounded-xl bg-slate-50 p-2">
                        <div className="text-slate-500">Узор</div>
                        <div className="font-medium">{selected.pattern}</div>
                      </div>
                    )}
                    {(selected.amount_issued ?? null) != null &&
                      (selected.amount_total ?? null) != null && (
                        <div className="rounded-xl bg-slate-50 p-2 col-span-2">
                          <div className="text-slate-500">Выпущено / Всего</div>
                          <div className="font-medium">
                            {new Intl.NumberFormat("ru-RU").format(
                              selected.amount_issued || 0
                            )}{" "}
                            /{" "}
                            {new Intl.NumberFormat("ru-RU").format(
                              selected.amount_total || 0
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  className="h-11 rounded-xl ring-1 ring-slate-200 hover:bg-slate-50"
                  onClick={() => setSelected(null)}
                >
                  Отмена
                </button>
                <button
                  className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={buying}
                  onClick={() => buy(selected!)}
                >
                  Купить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
