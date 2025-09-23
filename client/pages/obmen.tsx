// pages/casino.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";

/**
 * Простая рулетка «Казино» на основе стилистики из Exchange.
 * Оплата за один спин: 15 ⭐
 * Возможные исходы:
 *  -5 (обычный)
 *  -10 (обычный)
 *  -15 (обычный)
 *  -20 (обычный)
 *  -50 (редкий)
 *  -100 (очень редкий)
 *  +10000 (мега супер приз)
 *
 * Вероятности по умолчанию (сумма 100%):
 *  -5:    38%
 *  -10:   25%
 *  -15:   15%
 *  -20:   10%
 *  -50:    7%
 *  -100:   4.9%
 *  +10000: 0.1%
 *
 * Примечание: визуальные сектора равные по размеру — вероятности заложены в коде.
 */

const COST_PER_SPIN = 15;

// Описание призов и их веса (вероятностей)
const PRIZES = [
  { label: "-5", value: -5, rarity: "обычный", weight: 38 },
  { label: "-10", value: -10, rarity: "обычный", weight: 25 },
  { label: "-15", value: -15, rarity: "обычный", weight: 15 },
  { label: "-20", value: -20, rarity: "обычный", weight: 10 },
  { label: "-50", value: -50, rarity: "редкий", weight: 7 },
  { label: "-100", value: -100, rarity: "очень редкий", weight: 4.9 },
  { label: "+10000", value: 10000, rarity: "мега супер редкий", weight: 0.1 },
] as const;

const TOTAL_WEIGHT = PRIZES.reduce((s, p) => s + p.weight, 0);

export default function Casino() {
  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState<number>(200); // стартовый баланс для демо
  const [isSpinning, setIsSpinning] = useState(false);
  const [angle, setAngle] = useState(0); // текущий угол колеса
  const [result, setResult] = useState<null | { label: string; value: number; rarity: string }>(null);
  const [message, setMessage] = useState<string>("");
  const wheelRef = useRef<HTMLDivElement | null>(null);

  // Подхватываем баланс из localStorage
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    const saved = localStorage.getItem("starsBalance");
    if (saved) setBalance(parseInt(saved, 10));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    localStorage.setItem("starsBalance", String(balance));
  }, [balance]);

  // Цвета для сегментов (холодные оттенки)
  const segmentColors = useMemo(() => [
    "#bfdbfe", // -5
    "#93c5fd", // -10
    "#60a5fa", // -15
    "#3b82f6", // -20
    "#38bdf8", // -50
    "#0ea5e9", // -100
    "#22d3ee", // +10000
  ], []);

  // Генерация CSS conic-gradient под колесо
  const wheelBackground = useMemo(() => {
    const step = 360 / PRIZES.length;
    let parts: string[] = [];
    for (let i = 0; i < PRIZES.length; i++) {
      const start = i * step;
      const end = (i + 1) * step;
      parts.push(`${segmentColors[i]} ${start}deg ${end}deg`);
    }
    return `conic-gradient(${parts.join(',')})`;
  }, [segmentColors]);

  // Выбор приза по весам
  function pickPrize() {
    const r = Math.random() * TOTAL_WEIGHT;
    let acc = 0;
    for (const p of PRIZES) {
      acc += p.weight;
      if (r <= acc) return p;
    }
    return PRIZES[0]; // fallback
  }

  // Рассчитываем угол для конкретного индекса сектора (стрелка сверху на 0deg)
  function angleForIndex(index: number) {
    const step = 360 / PRIZES.length;
    // Центр сектора
    const center = index * step + step / 2;
    // Чтобы всегда крутилось несколько оборотов, добавим 5–7 оборотов сверху
    const baseTurns = 5 + Math.floor(Math.random() * 3); // 5..7
    const total = baseTurns * 360 + (360 - center); // стрелка на 0deg, значит останавливаем так, чтобы центр пришёл к 0deg
    return total;
  }

  // Индекс приза в массиве (визуальный порядок по часовой стрелке)
  function prizeIndex(prizeLabel: string) {
    return PRIZES.findIndex((p) => p.label === prizeLabel);
  }

  async function handleSpin() {
    setMessage("");
    setResult(null);

    if (isSpinning) return;
    if (balance < COST_PER_SPIN) {
      setMessage("Недостаточно ⭐ для спина. Пополните баланс.");
      return;
    }

    // Списываем стоимость спина
    setBalance((b) => b - COST_PER_SPIN);

    // Выбираем приз по весам
    const prize = pickPrize();

    // Крутим визуально на сектор с этим призом
    const idx = prizeIndex(prize.label);
    if (idx < 0) return;

    setIsSpinning(true);

    // Чуть рандомизируем внутри сектора ±10°
    const jitter = (Math.random() - 0.5) * (360 / PRIZES.length) * 0.55; // половина ширины сектора * 0.55
    const target = angleForIndex(idx) + jitter;

    // Плавно установим угол
    setAngle((prev) => prev + target);

    // Ждём завершения CSS-транзишна (~4.5s зададим ниже)
    window.setTimeout(() => {
      // Применяем результат к балансу
      setBalance((b) => b + prize.value);
      setResult(prize);
      setIsSpinning(false);
      if (prize.value >= 0) {
        setMessage(`Супер! Вы выиграли ${prize.value} ⭐`);
      } else {
        setMessage(`Увы! Вы потеряли ${Math.abs(prize.value)} ⭐`);
      }
    }, 4700);
  }

  return (
    <Layout title="Казино">
      {/* Фикс на весь экран без скролла */}
      <div className="relative h-[100dvh] overflow-hidden">
        {/* Fullscreen blue gradient */}
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          {/* base blue-ish gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#e6f0ff] via-[#dbeafe] to-[#e0f2fe]" />
          {/* radial blue accents */}
          <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_0%_0%,rgba(59,130,246,0.28)_0%,transparent_60%),radial-gradient(1000px_600px_at_100%_100%,rgba(2,132,199,0.26)_0%,transparent_60%)]" />
          {/* soft orbs */}
          <div className="absolute -top-24 left-1/4 h-[28rem] w-[28rem] rounded-full bg-white/25 blur-3xl" />
          <div className="absolute -bottom-24 right-1/5 h-[26rem] w-[26rem] rounded-full bg-white/20 blur-3xl" />
          {/* subtle grid */}
          <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(0deg,rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:40px_40px]" />
        </div>

        {/* Content */}
        <div className="relative flex h-[100dvh] items-center justify-center p-4">
          {/* Aura wrapper */}
          <div className="relative w-full max-w-[980px]">
            {/* light aura behind the card */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-0.5 rounded-[34px] blur-2xl opacity-80"
              style={{
                background:
                  "conic-gradient(from 180deg at 50% 50%, rgba(59,130,246,.35), rgba(2,132,199,.35), rgba(191,219,254,.35), rgba(59,130,246,.35))",
              }}
            />

            {/* Card */}
            <div
              className={[
                "relative rounded-[28px] bg-white/70 backdrop-blur-xl p-7 sm:p-10 ring-1 ring-white/50 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)]",
                "transition-all duration-700 ease-out",
                mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-[0.99]",
              ].join(" ")}
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
                    Казино: Рулетка ⭐
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Цена спина: <span className="font-semibold text-slate-900">{COST_PER_SPIN} ⭐</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-blue-50 px-4 py-2 text-sm font-medium text-slate-900 shadow-inner ring-1 ring-white">
                    Баланс: <span className="font-semibold">{balance}</span> ⭐
                  </div>
                  <button
                    onClick={() => setBalance(200)}
                    className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:opacity-90"
                  >
                    Сброс баланса (демо)
                  </button>
                </div>
              </div>

              {/* Wheel + Controls */}
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Wheel */}
                <div className="flex items-center justify-center">
                  <div className="relative">
                    {/* Pointer */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                      <div className="h-0 w-0 border-l-[12px] border-r-[12px] border-b-[18px] border-l-transparent border-r-transparent border-b-slate-900 drop-shadow" />
                    </div>

                    {/* Wheel Disc */}
                    <div
                      ref={wheelRef}
                      className="h-72 w-72 sm:h-80 sm:w-80 rounded-full ring-2 ring-white shadow-xl relative transition-transform [transition-timing-function:cubic-bezier(0.19,1,0.22,1)]"
                      style={{
                        background: wheelBackground,
                        transform: `rotate(${angle}deg)`,
                        transitionDuration: isSpinning ? "4.6s" : "0.3s",
                      }}
                    >
                      {/* Center cap */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-16 w-16 rounded-full bg-white/90 ring-1 ring-white shadow-md flex items-center justify-center text-lg font-bold text-slate-800">
                          ⭐
                        </div>
                      </div>

                      {/* Labels around wheel */}
                      {PRIZES.map((p, i) => {
                        const step = 360 / PRIZES.length;
                        const rot = i * step + step / 2; // центр сектора
                        return (
                          <div
                            key={p.label}
                            className="absolute left-1/2 top-1/2 origin-left text-xs sm:text-sm font-semibold text-slate-800"
                            style={{ transform: `rotate(${rot}deg) translateX(30%)` }}
                          >
                            {p.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Controls & Info */}
                <div className="flex flex-col justify-center">
                  <div className="rounded-2xl bg-white/70 ring-1 ring-white p-5 shadow-inner">
                    <div className="text-sm text-slate-600">
                      Возможные исходы и редкость (вероятности заложены в коде):
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PRIZES.map((p, i) => (
                        <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2 ring-1 ring-white">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-full" style={{ background: segmentColors[i] }} />
                            <span className="text-slate-800 font-medium">{p.label} ⭐</span>
                          </div>
                          <span className="text-xs text-slate-500">{p.rarity}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSpin}
                      disabled={isSpinning || balance < COST_PER_SPIN}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm disabled:opacity-40"
                    >
                      {isSpinning ? "Крутим…" : `Крутить за ${COST_PER_SPIN} ⭐`}
                    </button>

                    {message && (
                      <div className="mt-3 text-sm font-medium text-slate-800">
                        {message}
                      </div>
                    )}

                    {result && (
                      <div className="mt-2 text-xs text-slate-600">
                        Результат: <span className="font-semibold text-slate-900">{result.label} ⭐</span> — {result.rarity}
                      </div>
                    )}

                    <div className="mt-5 text-[11px] leading-5 text-slate-500">
                      ⚠️ Игра симулируется на клиенте для демо. Для продакшена используйте серверный RNG и
                      проверяемую справедливость. Стоимость спина списывается сразу, результат затем применяется
                      к балансу. Баланс хранится в localStorage браузера.
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                Вопросы и идеи — напишите администратору
                <a
                  href="https://t.me/ReelWalet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-slate-300 hover:decoration-slate-500"
                >
                  @ReelWalet
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
