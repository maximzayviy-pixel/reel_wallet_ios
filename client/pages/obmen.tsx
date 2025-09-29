// pages/obmen.tsx — Marketplace for Telegram Collectible Gifts (beta)
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StickerPlayer from "../components/StickerPlayer";

declare global { interface Window { Telegram: any } }

type Gift = {
  id: number;
  title: string;
  slug: string;
  number: number;
  tme_link: string;
  price_rub: number;
  image_url?: string | null;
  anim_url?: string | null;
  tgs_url?: string | null;
};

function CardSkeleton() {
  return (
    <div className="rounded-2xl p-3 bg-white ring-1 ring-slate-200 animate-pulse">
      <div className="aspect-square rounded-xl bg-slate-100" />
      <div className="mt-2 h-3 w-24 bg-slate-100 rounded" />
      <div className="mt-1 h-3 w-16 bg-slate-100 rounded" />
      <div className="mt-2 h-4 w-20 bg-slate-100 rounded" />
    </div>
  );
}

export default function Obmen() {
  const [items, setItems] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Gift | null>(null);
  const [buying, setBuying] = useState(false);
  const [showBeta, setShowBeta] = useState(false);

  // beta modal once
  useEffect(() => {
    if (!localStorage.getItem("gift_shop_beta_shown")) setShowBeta(true);
  }, []);
  const closeBeta = () => {
    localStorage.setItem("gift_shop_beta_shown", "1");
    setShowBeta(false);
  };

  // Telegram initData
  useEffect(() => {
    try {
      window?.Telegram?.WebApp?.ready?.();
      const initData = window?.Telegram?.WebApp?.initData || "";
      if (initData) localStorage.setItem("tg_init_data", initData);
    } catch {}
  }, []);

  // load gifts
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/gifts/list");
        const j = await r.json();
        if (j.ok) setItems(j.items || []);
        else setError(j.error || "Ошибка загрузки");
      } catch {
        setError("Ошибка сети");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const buy = async (gift: Gift) => {
    setBuying(true);
    try {
      const initData =
        window?.Telegram?.WebApp?.initData ||
        localStorage.getItem("tg_init_data") ||
        "";
      const r = await fetch("/api/gifts/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-init-data": initData,
        },
        body: JSON.stringify({ gift_id: gift.id }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Ошибка");
      window.open(j.tme_link, "_blank");
    } catch (e: any) {
      alert("Не удалось купить: " + e.message);
    } finally {
      setBuying(false);
    }
  };

  return (
    <Layout title="Обмен — маркетплейс подарков">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">

        {/* Beta notice */}
        {showBeta && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-[92%] max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <div className="text-lg font-semibold">Магазин в бете</div>
              <p className="mt-2 text-sm text-slate-600">
                Это ранняя версия витрины коллекционных подарков Telegram. Возможны баги и задержки.
              </p>
              <div className="mt-4 flex justify-end">
                <button onClick={closeBeta} className="h-10 px-4 rounded-xl bg-blue-600 text-white">Окей</button>
              </div>
            </div>
          </div>
        )}

        {error && <div className="text-red-600">{error}</div>}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-slate-500 py-16">
            Пока нет активных подарков. Загляните позже.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {items.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelected(g)}
                className="group rounded-3xl bg-gradient-to-b from-white to-slate-50 ring-1 ring-slate-200 p-3 text-left shadow-sm hover:shadow transition"
              >
                <div className="aspect-square rounded-2xl bg-slate-50 overflow-hidden flex items-center justify-center relative">
                  <div className="absolute inset-0 pointer-events-none opacity-60 mix-blend-multiply bg-[radial-gradient(60%_60%_at_50%_40%,#93c5fd_10%,transparent_60%)]" />
                  {g.tgs_url ? (
                    <StickerPlayer tgsUrl={g.tgs_url} poster={g.image_url || null} className="relative z-10 w-full h-full" />
                  ) : g.anim_url ? (
                    <video
                      src={g.anim_url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      poster={g.image_url || undefined}
                      className="relative z-10 w-full h-full object-cover"
                    />
                  ) : g.image_url ? (
                    <img src={g.image_url} alt={g.title} className="relative z-10 w-full h-full object-cover" />
                  ) : (
                    <span className="relative z-10 text-5xl">🎁</span>
                  )}
                </div>
                <div className="mt-2">
                  <div className="text-sm font-medium truncate">{g.title}</div>
                  <div className="text-[11px] text-slate-500">#{g.number}</div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[12px] font-semibold text-emerald-700">
                    {g.price_rub} ₽
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setSelected(null)}>
            <div className="bg-white rounded-2xl w-full sm:w-[440px] p-4 m-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-3">
                <div className="w-28 h-28 rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center relative">
                  <div className="absolute inset-0 pointer-events-none opacity-60 mix-blend-multiply bg-[radial-gradient(60%_60%_at_50%_40%,#93c5fd_10%,transparent_60%)]" />
                  {selected.tgs_url ? (
                    <StickerPlayer tgsUrl={selected.tgs_url} poster={selected.image_url || null} className="relative z-10 w-full h-full" />
                  ) : selected.anim_url ? (
                    <video
                      src={selected.anim_url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      poster={selected.image_url || undefined}
                      className="relative z-10 w-full h-full object-cover"
                    />
                  ) : selected.image_url ? (
                    <img src={selected.image_url} className="relative z-10 w-full h-full object-cover" />
                  ) : (
                    <span className="relative z-10 text-4xl">🎁</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{selected.title}</div>
                  <div className="text-xs text-slate-500 mb-2">
                    <a className="underline" href={selected.tme_link} target="_blank" rel="noreferrer">
                      Открыть в Telegram
                    </a>
                  </div>
                  <div className="text-2xl font-bold">{selected.price_rub} ₽</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button className="h-11 rounded-xl ring-1 ring-slate-200" onClick={() => setSelected(null)}>Отмена</button>
                <button className="h-11 rounded-xl bg-blue-600 text-white disabled:opacity-60" disabled={buying} onClick={() => buy(selected!)}>
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
