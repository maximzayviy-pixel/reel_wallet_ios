import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";

const COST_PER_SPIN = 15;

const PRIZES = [
  { label: "-5", value: -5, rarity: "обычный" },
  { label: "-10", value: -10, rarity: "обычный" },
  { label: "-15", value: -15, rarity: "обычный" },
  { label: "-20", value: -20, rarity: "обычный" },
  { label: "-50", value: -50, rarity: "редкий" },
  { label: "-100", value: -100, rarity: "очень редкий" },
  { label: "+10000", value: 10000, rarity: "мега супер редкий" },
] as const;

export default function Casino() {
  const [mounted, setMounted] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<null | { label: string; value: number; rarity: string }>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  const wheelSize = typeof window !== "undefined" ? Math.min(window.innerWidth * 0.82, 520) : 320;

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    fetch("/api/me-balance").then(async (r) => {
      try {
        const j = await r.json();
        setBalance(j?.balance ?? 0);
      } catch {}
    });
    return () => cancelAnimationFrame(t);
  }, []);

  const segmentColors = useMemo(
    () => ["#E8F1FF", "#D7E7FF", "#C7DEFF", "#B2D2FF", "#BDEFFF", "#A6E1FF", "#A7F3F0"],
    []
  );

  const wheelBackground = useMemo(() => {
    const step = 360 / PRIZES.length;
    return `conic-gradient(${PRIZES.map(
      (_, i) => `${segmentColors[i]} ${i * step}deg ${(i + 1) * step}deg`
    ).join(",")})`;
  }, [segmentColors]);

  function indexByLabel(label: string) {
    return PRIZES.findIndex((p) => p.label === label);
  }

  function angleForIndex(index: number) {
    const step = 360 / PRIZES.length;
    const center = index * step + step / 2;
    const baseTurns = 5 + Math.floor(Math.random() * 3);
    return baseTurns * 360 + (360 - center);
  }

  async function handleSpin() {
    setError("");
    setMessage("");
    setResult(null);
    if (isSpinning) return;

    try {
      setIsSpinning(true);
      const r = await fetch("/api/roulette-spin", { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error === "NOT_ENOUGH_STARS" ? "Недостаточно ⭐" : "Ошибка спина");
        setIsSpinning(false);
        return;
      }

      const prize = j.prize;
      const newBalance = j.balance;
      const idx = indexByLabel(prize.label);
      const jitter = (Math.random() - 0.5) * (360 / PRIZES.length) * 0.5;
      const target = angleForIndex(idx) + jitter;
      setAngle((prev) => prev + target);

      window.setTimeout(() => {
        setIsSpinning(false);
        setResult(prize);
        setBalance(newBalance);
        setMessage(prize.value >= 0 ? `Супер! Вы выиграли ${prize.value} ⭐` : `Увы! -${Math.abs(prize.value)} ⭐`);
      }, 4700);
    } catch {
      setIsSpinning(false);
      setError("Сеть недоступна");
    }
  }

  return (
    <Layout title="Казино">
      <div className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-b from-[#eaf2ff] via-[#e6f2ff] to-[#e0f7ff]">
        <div className="relative flex flex-col items-stretch px-3 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-[calc(env(safe-area-inset-top)+12px)] sm:px-4">
          <div className="mx-auto w-full max-w-[680px]">
            <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
              <div>
                <h1 className="text-[20px] font-semibold text-slate-900">Рулетка ⭐</h1>
                <p className="text-[12px] text-slate-600">Спин — {COST_PER_SPIN} ⭐</p>
              </div>
              <div className="rounded-xl bg-slate-900/90 text-white text-sm font-semibold px-3 py-2 shadow-sm">
                Баланс: {balance ?? "…"}
              </div>
            </div>
          </div>

          <div className="mt-4 mx-auto w-full max-w-[680px] flex items-center justify-center">
            <div className="relative" style={{ width: wheelSize, height: wheelSize }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                <div className="h-0 w-0 border-l-[12px] border-r-[12px] border-b-[18px] border-l-transparent border-r-transparent border-b-slate-900" />
              </div>
              <div
                className="rounded-full ring-2 ring-white shadow-xl relative transition-transform"
                style={{
                  width: "100%",
                  height: "100%",
                  background: wheelBackground,
                  transform: `rotate(${angle}deg)`,
                  transitionDuration: isSpinning ? "4.6s" : "0.3s",
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-16 w-16 rounded-full bg-white/90 shadow-md flex items-center justify-center text-lg font-bold text-slate-800">⭐</div>
                </div>
                {PRIZES.map((p, i) => {
                  const step = 360 / PRIZES.length;
                  const rot = i * step + step / 2;
                  return (
                    <div key={p.label} className="absolute left-1/2 top-1/2 origin-left text-[12px] font-semibold text-slate-800"
                      style={{ transform: `rotate(${rot}deg) translateX(30%)` }}>
                      {p.label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mx-auto mt-4 w-full max-w-[680px] grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRIZES.map((p, i) => (
              <div key={p.label} className="flex items-center rounded-xl bg-white/70 px-3 py-2 shadow-sm">
                <span className="inline-block h-3 w-3 rounded-full mr-2" style={{ background: segmentColors[i] }} />
                <span className="text-[13px] font-medium text-slate-800">{p.label} ⭐</span>
              </div>
            ))}
          </div>

          <div className="mt-3">
            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl">{error}</div>}
            {message && <div className="bg-emerald-50 text-emerald-700 text-sm px-3 py-2 rounded-xl">{message}</div>}
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2">
          <div className="mx-auto w-full max-w-[680px] rounded-2xl bg-white/80 shadow-lg">
            <div className="flex items-center justify-between p-3">
              <div className="text-[12px] text-slate-600">Спин списывает {COST_PER_SPIN}⭐</div>
              <button onClick={handleSpin} disabled={isSpinning || (balance !== null && balance < COST_PER_SPIN)}
                className="rounded-xl bg-slate-900 px-5 py-3 text-[15px] font-semibold text-white disabled:opacity-40">
                {isSpinning ? "Крутим…" : "Крутить"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
