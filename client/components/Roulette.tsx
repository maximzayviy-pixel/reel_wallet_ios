// components/Roulette.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

const COST = 15;

type SpinOk = { ok: true; prize: number | "PLUSH_PEPE_NFT"; balance: number; tg_id: number };
type SpinErr = { ok: false; error: string; details?: string; balance?: number; tg_id?: number };
type SpinResp = SpinOk | SpinErr;

function isOk(x: SpinResp): x is SpinOk { return x.ok === true; }

function pctBadgeColor(p: number) {
  // 30 -> зеленый, 0.1 -> красный
  if (p >= 20) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (p >= 8) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (p >= 2) return "bg-orange-50 text-orange-700 ring-orange-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

export default function Roulette({
  tgId,
  stars,
  onBalanceChange,
}: { tgId: number; stars: number; onBalanceChange: (v: number) => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean>(true);

  // загрузка согласия 1 раз
  useEffect(() => {
    try {
      const v = localStorage.getItem("roulette_agreed_v1");
      setAllowed(v === "1");
    } catch {}
  }, []);

  const prizes = useMemo(
    () => [
      { label: "+3", val: 3, p: 30 },
      { label: "+5", val: 5, p: 24 },
      { label: "+10", val: 10, p: 18 },
      { label: "+15", val: 15, p: 12 },
      { label: "+50", val: 50, p: 8 },
      { label: "+100", val: 100, p: 5.5 },
      { label: "+1000", val: 1000, p: 2.4 },
      { label: "Plush Pepe NFT", val: "PLUSH_PEPE_NFT" as const, p: 0.1, img: "https://i.imgur.com/BmoA5Ui.jpeg" },
    ],
    []
  );

  // лёгкая автоинерция прокрутки
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    let vx = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        vx += e.deltaY * 0.2;
        e.preventDefault();
      }
    };
    const step = () => {
      el.scrollLeft += vx;
      vx *= 0.92; // затухание
      if (Math.abs(vx) > 0.1) raf = requestAnimationFrame(step);
    };
    const start = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(step); };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("wheel", start);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("wheel", start);
    };
  }, []);

  const spin = useCallback(async () => {
    setErr(null);
    if (loading || !allowed) return;
    if (stars < COST) { setErr("Недостаточно звёзд"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/roulette-spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tg_id: tgId }),
      });
      const json: SpinResp = await r.json();
      if (isOk(json)) {
        onBalanceChange(json.balance);
        // всплывающая гифка можно вставить тут как оверлей на пару секунд,
        // если понадобится — добавим <img src="/spin.gif" /> через состояние.
      } else {
        const msg = json.details ? `${json.error}: ${json.details}` : json.error;
        setErr(msg);
      }
    } catch {
      setErr("SPIN_FAILED");
    } finally {
      setLoading(false);
    }
  }, [tgId, stars, allowed, loading, onBalanceChange]);

  return (
    <section className="px-4 pb-24 pt-6">
      <h2 className="text-[20px] font-semibold mb-2">Рулетка</h2>
      <div className="text-sm text-slate-600 mb-3">
        Стоимость — <b>{COST} ⭐</b>{" "}
        <span className="ml-2 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs">
          баланс: {stars}
        </span>
      </div>

      <div className="relative rounded-3xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 p-3 shadow-sm">
        {/* размытие до согласия */}
        {!allowed && (
          <div className="absolute inset-0 z-10 backdrop-blur-sm bg-white/50 rounded-3xl flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow p-4 max-w-sm text-center mx-3">
              <div className="font-semibold mb-2">Соглашение</div>
              <p className="text-sm text-slate-600 mb-3">
                Чтобы играть, подтвердите, что вы ознакомились с{" "}
                <a
                  className="text-blue-600 underline"
                  href="https://telegra.ph/Polzivatelskoe-soglashenie-Game-Reel-Wallet-09-29"
                  target="_blank"
                >
                  пользовательским соглашением
                </a>.
              </p>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" onChange={(e) => {
                  if (e.target.checked) {
                    try { localStorage.setItem("roulette_agreed_v1", "1"); } catch {}
                    setAllowed(true);
                  }
                }} />
                <span>Ознакомился</span>
              </label>
            </div>
          </div>
        )}

        {/* горизонтальные карточки */}
        <div ref={scrollerRef} className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory">
          {prizes.map((p, i) => (
            <div
              key={i}
              className="snap-center shrink-0 w-60 h-28 rounded-2xl border border-amber-200 bg-white/85 shadow hover:shadow-md transition relative"
            >
              {/* иконка/картинка слева */}
              {p.img ? (
                <Image
                  src={p.img}
                  alt="Plush Pepe"
                  width={56}
                  height={56}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg object-contain"
                />
              ) : (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-yellow-100 grid place-items-center text-lg">⭐</div>
              )}
              <div className="ml-20 h-full flex flex-col items-start justify-center pr-3">
                <div className="text-[22px] font-semibold">
                  {p.label}{typeof p.val === "number" ? " ⭐" : ""}
                </div>
                <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${pctBadgeColor(p.p)}`}>
                  {p.p}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* кнопки */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={spin}
            disabled={loading || !allowed}
            className="rounded-xl bg-blue-600 text-white px-4 py-3 font-semibold disabled:opacity-60"
          >
            {loading ? "Крутим…" : `Крутить за ${COST} ⭐`}
          </button>
          {err && (
            <div className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2 max-w-[70%]">
              {err}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
