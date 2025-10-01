// components/Roulette.tsx
import { useMemo, useRef, useState, useEffect } from "react";
import { emitStars } from "../lib/bus";

type Props = { tgId: number; stars: number; onBalanceChange(v: number): void };
type SpinOk  = { ok: true;  prize: number | "PLUSH_PEPE_NFT"; balance: number; tg_id: number };
type SpinErr = { ok: false; error: string; details?: string; balance?: number; tg_id?: number };
type SpinResp = SpinOk | SpinErr;

type PrizeBase = { label: string; value: number | "PLUSH_PEPE_NFT"; weight: number; image?: string; };
type PrizeWithChance = PrizeBase & { chance: number };

const COST = 15;

const PRIZES: PrizeBase[] = [
  { label: "+3 ⭐",    value: 3,    weight: 30 },
  { label: "+5 ⭐",    value: 5,    weight: 24 },
  { label: "+10 ⭐",   value: 10,   weight: 18 },
  { label: "+15 ⭐",   value: 15,   weight: 12 },
  { label: "+50 ⭐",   value: 50,   weight: 8  },
  { label: "+100 ⭐",  value: 100,  weight: 5.5},
  { label: "+1000 ⭐", value: 1000, weight: 2.4},
  { label: "Plush Pepe NFT", value: "PLUSH_PEPE_NFT", weight: 0.1, image: "https://i.imgur.com/BmoA5Ui.jpeg" },
];

export default function Roulette({ tgId, stars, onBalanceChange }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [termsOk, setTermsOk] = useState<boolean>(true);

  useEffect(() => { try { setTermsOk(!!localStorage.getItem("roulette_terms_ok")); } catch {} }, []);

  const totalWeight = useMemo(() => PRIZES.reduce((s,p)=>s+p.weight, 0), []);
  const chances: PrizeWithChance[] = useMemo(
    () => PRIZES.map(p => ({ ...p, chance: +(p.weight * 100 / totalWeight).toFixed(2) })),
    [totalWeight]
  );

  const railRef = useRef<HTMLDivElement>(null);

  const spinToIndex = (targetIdx: number) => {
    const rail = railRef.current;
    if (!rail) return;
    
    const cards = rail.querySelectorAll<HTMLElement>("[data-card]");
    if (cards.length === 0) return;
    
    const base = PRIZES.length;
    const card = cards[base + targetIdx];
    if (!card) return;

    const center = rail.clientWidth / 2 - card.clientWidth / 2;
    const dest = card.offsetLeft - center;

    const loopWidth = cards[0].clientWidth + 12;
    const extra = loopWidth * PRIZES.length * 2;
    const finalLeft = dest + extra;

    rail.style.scrollBehavior = "auto";
    const start = rail.scrollLeft;
    const dist = finalLeft - start;
    const dur = 2200;
    
    // Улучшенная функция easing для более плавной анимации
    const ease = (t: number) => {
      t = Math.min(Math.max(t, 0), 1);
      // Cubic bezier easing для более естественного движения
      return 1 - Math.pow(1 - t, 3);
    };
    
    let t0: number | null = null;
    let animationId: number | null = null;
    
    const tick = (ts: number) => {
      if (t0 == null) t0 = ts;
      const p = Math.min(1, (ts - t0) / dur);
      rail.scrollLeft = start + dist * ease(p);
      
      if (p < 1) {
        animationId = requestAnimationFrame(tick);
      } else {
        // Убеждаемся, что анимация остановлена
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
      }
    };
    
    animationId = requestAnimationFrame(tick);
    
    // Очистка при размонтировании компонента
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  };

  const run = async () => {
    setErr(null);
    if (spinning) return;
    if (!termsOk) { setErr("Сначала отметь согласие с правилами ниже."); return; }
    if (!tgId) { setErr("Не удалось определить Telegram ID"); return; }
    if (stars < COST) { setErr("Недостаточно звёзд"); return; }

    setSpinning(true);

    // ⚡ Оптимистично списываем 15 — и сообщаем глобально
    const optimistic = stars - COST;
    onBalanceChange(optimistic);
    emitStars({ stars: optimistic, tgId });

    try {
      const initData = (window as any)?.Telegram?.WebApp?.initData || "";
      const r = await fetch("/api/roulette-spin", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "x-init-data": initData, 
          "x-tg-id": String(tgId) 
        },
        body: JSON.stringify({ tg_id: tgId }),
      });

      let json: SpinResp;
      try {
        json = await r.json();
      } catch (parseError) {
        throw new Error("Ошибка обработки ответа сервера");
      }

      if (!r.ok) {
        throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      }

      if (!json.ok) {
        const e = json as SpinErr;
        // откатываем везде (локально и глобально)
        onBalanceChange(stars);
        emitStars({ stars, tgId });
        
        if (e.error === "NOT_ENOUGH_STARS") {
          setErr("Недостаточно звёзд для игры");
        } else if (e.error === "NO_TG_ID") {
          setErr("Не удалось определить Telegram ID");
        } else if (e.error === "BALANCE_QUERY_FAILED") {
          setErr("Ошибка проверки баланса");
        } else if (e.error === "SPIN_FAILED") {
          setErr(`Ошибка сервера: ${e.details || "неизвестная ошибка"}`);
        } else {
          setErr(`${e.error}${e.details ? `: ${e.details}` : ""}`);
        }
      } else {
        // крутим к выигрышу
        const idx = PRIZES.findIndex(p => p.value === json.prize);
        if (idx >= 0 && railRef.current) {
          spinToIndex(idx);
        }

        // через окончание анимации — ставим точный баланс из API и рассылаем глобально
        setTimeout(() => {
          onBalanceChange(json.balance);
          emitStars({ stars: json.balance, tgId });
        }, 2300);
      }
    } catch (e: any) {
      // сеть упала — полный откат
      onBalanceChange(stars);
      emitStars({ stars, tgId });
      
      if (e.name === "TypeError" && e.message.includes("fetch")) {
        setErr("Сеть недоступна. Проверьте подключение к интернету.");
      } else {
        setErr(`Ошибка: ${e?.message || "неизвестная ошибка"}`);
      }
    } finally {
      setTimeout(() => setSpinning(false), 2300);
    }
  };

  return (
    <section className="px-4 pb-24 pt-6">
      {!termsOk && <div className="fixed inset-0 z-30 bg-black/45 backdrop-blur-sm pointer-events-none" />}

      <h2 className="text-[20px] font-semibold mb-2">Рулетка</h2>
      <div className="text-sm text-slate-600 mb-3">
        Стоимость — <b>{COST} ⭐</b>
        <span className="ml-2 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs">баланс: {stars}</span>
      </div>

      <div ref={railRef} className="relative overflow-x-auto no-scrollbar rounded-3xl ring-1 ring-slate-200 bg-white" style={{ scrollBehavior: "smooth" }}>
        <div className="flex gap-3 p-4 min-w-max">
          {Array.from({ length: 6 }).flatMap((_, loop) =>
            chances.map((p, i) => (
              <div key={`${loop}-${i}`} data-card className="snap-center w-40 shrink-0 rounded-2xl ring-1 ring-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 p-3 flex flex-col items-center justify-center">
                <div className="h-24 w-full flex items-center justify-center overflow-hidden">
                  {p.image ? (
                    <img src={p.image} alt="Plush Pepe" className="h-24 w-full object-contain" />
                  ) : (
                    <div className="text-2xl font-bold">{typeof p.value === "number" ? `+${p.value} ⭐` : p.label}</div>
                  )}
                </div>
                <div className="mt-2 text-center text-sm font-medium">{p.label}</div>
              </div>
            ))
          )}
        </div>

        {spinning && (
          <div className="absolute inset-0 z-20 grid place-items-center pointer-events-none">
            <img src="https://s4.ezgif.com/tmp/ezgif-4a73d92325fcc3.gif" alt="" className="h-40 w-40 object-contain mix-blend-multiply" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">Твой баланс: <b>{stars}</b> ⭐</div>
        <button onClick={run} disabled={spinning} className="h-11 px-5 rounded-xl bg-blue-600 text-white disabled:opacity-60">
          {spinning ? "Крутим…" : `Крутить за ${COST} ⭐`}
        </button>
      </div>
      {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
    </section>
  );
}
