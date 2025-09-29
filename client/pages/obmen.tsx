// pages/obmen.tsx — маркетплейс подарков
import { useEffect, useMemo, useState } from "react";
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
  image_url?: string | null;
  anim_url?: string | null;
  tgs_url?: string | null;
  model?: string | null;
  backdrop?: string | null;
  pattern?: string | null;
  amount_total?: number | null;
  amount_issued?: number | null;
};

export default function Obmen() {
  const [items, setItems] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [selected, setSelected] = useState<Gift | null>(null);
  const [buying, setBuying] = useState(false);
  const [showBeta, setShowBeta] = useState(true);

  useEffect(() => {
    // читаем из localStorage скрыт ли бета-баннер
    try { if (localStorage.getItem("beta_ack") === "1") setShowBeta(false); } catch {}
    fetch("/api/gifts/list")
      .then(r => r.json())
      .then(j => { if (j.ok) setItems(j.items); else setError(j.error || "Ошибка загрузки"); })
      .catch(() => setError("Ошибка сети"))
      .finally(() => setLoading(false));
  }, []);

  const buy = async (gift: Gift) => {
    setBuying(true);
    try {
      const r = await fetch("/api/gifts/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": (window as any)?.Telegram?.WebApp?.initData || "",
        },
        body: JSON.stringify({ gift_id: gift.id }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Ошибка");
      window.open(j.tme_link, "_blank");
      alert("Покупка успешна! Ссылка на подарок открыта.");
    } catch (e: any) {
      alert("Не удалось купить: " + (e?.message || "Ошибка"));
    } finally {
      setBuying(false);
    }
  };

  return (
    <Layout title="Обмен — подарки Telegram">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        {showBeta && (
          <div className="mb-4 rounded-2xl bg-yellow-50 ring-1 ring-yellow-200 p-4 text-yellow-900">
            <div className="font-semibold mb-1">Бета-версия магазина</div>
            <div className="text-sm opacity-90">
              Функции ещё дорабатываются — возможны баги и задержки загрузки превью.
            </div>
            <div className="mt-3">
              <button
                onClick={() => { setShowBeta(false); try { localStorage.setItem("beta_ack", "1"); } catch {} }}
                className="h-9 px-3 rounded-lg bg-yellow-600 text-white"
              >
                Окей
              </button>
            </div>
          </div>
        )}

        {loading && <div className="text-slate-500">Загрузка…</div>}
        {error && <div className="text-red-600">{error}</div>}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((g) => {
            const price = g.price_rub ?? g.value_rub ?? 0;
            return (
              <button
                key={g.id}
                onClick={() => setSelected(g)}
                className="group rounded-2xl bg-white ring-1 ring-slate-200 p-3 text-left shadow-sm hover:shadow-md transition"
              >
                <div className="relative aspect-[1/1] rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center">
                  {g.tgs_url ? (
                    <StickerPlayer tgsUrl={g.tgs_url} poster={g.image_url ?? undefined} className="w-full h-full" />
                  ) : g.image_url ? (
                    <img src={g.image_url} alt={g.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">🎁</span>
                  )}
                </div>
                <div className="mt-2">
                  <div className="text-sm font-medium line-clamp-1">{g.title}</div>
                  <div className="text-xs text-slate-500">#{g.number}</div>
                  <div className="text-sm font-semibold mt-1 text-emerald-600">
                    {price.toLocaleString("ru-RU")} ₽
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Modal */}
        {selected && (
          <div
            className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50"
            onClick={() => setSelected(null)}
          >
            <div
              className="bg-white rounded-2xl w-full sm:w-[520px] p-4 m-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-3">
                <div className="w-28 h-28 rounded-xl bg-slate-50 overflow-hidden relative">
                  {selected.tgs_url ? (
                    <StickerPlayer
                      tgsUrl={selected.tgs_url}
                      poster={selected.image_url ?? undefined}
                      className="w-full h-full"
                    />
                  ) : selected.image_url ? (
                    <img src={selected.image_url} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl flex items-center justify-center h-full">🎁</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{selected.title}</div>
                  <div className="text-xs text-slate-500 mb-2">
                    <a className="underline" href={selected.tme_link} target="_blank" rel="noreferrer">
                      Открыть в Telegram
                    </a>
                    &nbsp;·&nbsp;#{selected.number}
                  </div>
                  <div className="text-2xl font-bold">
                    {(selected.price_rub ?? selected.value_rub ?? 0).toLocaleString("ru-RU")} ₽
                  </div>
                </div>
              </div>

              {/* характеристики */}
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {selected.model && (
                  <>
                    <div className="text-slate-500">Модель</div>
                    <div className="font-medium">{selected.model}</div>
                  </>
                )}
                {selected.backdrop && (
                  <>
                    <div className="text-slate-500">Фон</div>
                    <div className="font-medium">{selected.backdrop}</div>
                  </>
                )}
                {selected.pattern && (
                  <>
                    <div className="text-slate-500">Узор</div>
                    <div className="font-medium">{selected.pattern}</div>
                  </>
                )}
                {(selected.amount_total || selected.amount_issued) && (
                  <>
                    <div className="text-slate-500">Количество</div>
                    <div className="font-medium">
                      {selected.amount_total?.toLocaleString("ru-RU")}
                      {selected.amount_issued
                        ? `, выпущено ${selected.amount_issued.toLocaleString("ru-RU")}`
                        : ""}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button className="h-11 rounded-xl ring-1 ring-slate-200" onClick={() => setSelected(null)}>
                  Отмена
                </button>
                <button
                  className="h-11 rounded-xl bg-blue-600 text-white disabled:opacity-60"
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
