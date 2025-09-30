// pages/obmen.tsx — вкладка «Обмен» с родным фоном Telegram
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StickerPlayer from "../components/StickerPlayer";
import Roulette from "../components/Roulette";

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
  backdrop: string | null;
  pattern: string | null;
  amount_issued: number | null;
  amount_total: number | null;
  preview_svg: string | null;
};

export default function Obmen() {
  const [items, setItems] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Gift | null>(null);
  const [buying, setBuying] = useState(false);

  // 🔹 рулетка
  const [tgId, setTgId] = useState<number>(0);
  const [stars, setStars] = useState<number>(0);

  // баннер «бета» (оставляю как в твоём варианте)
  const [betaHidden, setBetaHidden] = useState(true);
  useEffect(() => {
    try {
      const seen = typeof window !== "undefined" ? window.sessionStorage.getItem("beta_banner_seen_v1") : "1";
      setBetaHidden(!!seen);
    } catch { setBetaHidden(true); }
  }, []);

  // загрузка товаров
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

  // helper — баланс
  const refreshBalance = async (id: number) => {
    if (!id) return;
    try {
      const r = await fetch(`/api/my-balance?tg_id=${id}`);
      const j = await r.json();
      if (j?.ok) setStars(Number(j.stars || 0));
    } catch {}
  };

  // init tgId: Telegram → ?tg_id → localStorage
  useEffect(() => {
    try {
      const w: any = typeof window !== "undefined" ? window : undefined;
      const tg = w?.Telegram?.WebApp;
      const fromTg = tg?.initDataUnsafe?.user?.id ? Number(tg.initDataUnsafe.user.id) : 0;
      const params = new URLSearchParams(w?.location?.search || "");
      const fromQuery = Number(params.get("tg_id") || params.get("debug_tg_id") || 0);
      const fromLS = Number((() => { try { return localStorage.getItem("debug_tg_id") || "0"; } catch { return "0"; } })());
      const id = fromTg || fromQuery || fromLS || 0;
      if (id) {
        setTgId(id);
        refreshBalance(id);
        try { localStorage.setItem("debug_tg_id", String(id)); } catch {}
      }
    } catch {}
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
      window.open(j.tme_link, "_blank");
      alert("Покупка успешна! Ссылка на подарок открыта.");
      if (tgId) refreshBalance(tgId); // сразу обновим баланс для рулетки
    } catch (e: any) {
      alert("Не удалось купить: " + (e?.message || "Ошибка"));
    } finally { setBuying(false); }
  };

  const fmtRUB = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
  const priceOf = (g: Gift) => g.value_rub ?? g.price_rub ?? 0;

  const cardBg = (g: Gift): React.CSSProperties => {
    if (g.preview_svg) {
      return {
        backgroundImage: `url("${g.preview_svg}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    }
    return { background: "linear-gradient(180deg,#e9eef8,#7a8da8)" };
  };

  return (
    <Layout title="Обмен — подарки Telegram">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">

        {!betaHidden && (
          <div className="mb-5 rounded-2xl border border-yellow-200 bg-yellow-50 text-yellow-900 p-4">
            <div className="font-semibold mb-1">Бета-версия магазина</div>
            <div className="text-sm opacity-90">Функции ещё дорабатываются — возможны баги и задержки загрузки превью.</div>
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
        {error && <div className="text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelected(g)}
              className="group rounded-3xl bg-white ring-1 ring-slate-200 hover:ring-slate-300 transition p-3 text-left shadow-sm hover:shadow-md"
            >
              <div className="relative aspect-square rounded-2xl overflow-hidden" style={cardBg(g)}>
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
                <div className="text-sm font-semibold mt-1 text-emerald-600">{fmtRUB(priceOf(g))}</div>
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setSelected(null)}>
            <div className="bg-white rounded-3xl w-full sm:w-[560px] p-4 sm:p-6 m-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-4 items-start">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0" style={cardBg(selected)}>
                  <div className="absolute inset-0 p-2 flex items-center justify-center">
                    <StickerPlayer
                      tgsUrl={selected.tgs_url || undefined}
                      poster={selected.image_url || undefined}
                      className="w-full h-full"
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <div className="font-semibold text-[17px] leading-5">{selected.title}</div>
                  <a href={selected.tme_link} target="_blank" className="text-xs text-blue-600 underline" rel="noreferrer">Открыть в Telegram</a>
                  <div className="text-2xl font-bold mt-1">{fmtRUB(priceOf(selected))}</div>

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
                    {(selected.amount_issued ?? null) != null && (selected.amount_total ?? null) != null && (
                      <div className="rounded-xl bg-slate-50 p-2 col-span-2">
                        <div className="text-slate-500">Выпущено / Всего</div>
                        <div className="font-medium">
                          {new Intl.NumberFormat("ru-RU").format(selected.amount_issued || 0)} /{" "}
                          {new Intl.NumberFormat("ru-RU").format(selected.amount_total || 0)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button className="h-11 rounded-xl ring-1 ring-slate-200 hover:bg-slate-50" onClick={() => setSelected(null)}>Отмена</button>
                <button className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60" disabled={buying} onClick={() => buy(selected!)}>
                  Купить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* отступ под нижний бар, чтобы не перекрывал */}
      <div className="mb-20" />
      <Roulette tgId={tgId} stars={stars} onBalanceChange={setStars} />
    </Layout>
  );
}
