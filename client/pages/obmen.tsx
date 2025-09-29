import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Готовая страница obmen.tsx (Next.js/React)
 *
 * Что внутри:
 * 1) Рулетка-колесо с призами (включая Plush Pepe NFT)
 * 2) Списание 15 звёзд при нажатии «Крутить» и начисление выигрыша после остановки
 * 3) Всплывающий GIF-анимационный эффект со «снятием» зелёного хромакея на лету через Canvas
 * 4) Простая система баланса через localStorage (звёзды). При желании замените на свои API.
 *
 * Как интегрировать с проектом:
 * - Замените текущий файл pages/obmen.tsx (или app/obmen/page.tsx — адаптируйте экспорт) на этот.
 * - При необходимости подключите Tailwind/стили (здесь используются инлайн-стили + CSS-переменные).
 * - Чтобы связать с бэкендом, замените функции getBalance/setBalance/award на ваши вызовы API.
 */

// ------------------------------ НАСТРОЙКИ ------------------------------
const SPIN_COST = 15; // Стоимость одного спина

// Призы. Если type === "stars", value может быть отрицательным или положительным.
// Если type === "nft", value игнорируется и раздаём NFT (можете записать факт в БД).
const PRIZES: Array<
  | { type: "stars"; label: string; value: number; weight: number }
  | { type: "nft"; label: string; image: string; weight: number }
> = [
  { type: "stars", label: "-3 звезды", value: -3, weight: 16 },
  { type: "stars", label: "-5 звёзд", value: -5, weight: 14 },
  { type: "stars", label: "-10 звёзд", value: -10, weight: 12 },
  { type: "stars", label: "-15 звёзд", value: -15, weight: 10 },
  { type: "stars", label: "-50 звёзд", value: -50, weight: 6 },
  { type: "stars", label: "-100 звёзд", value: -100, weight: 4 },
  { type: "stars", label: "-1000 звёзд", value: -1000, weight: 1 },
  {
    type: "nft",
    label: "Plush Pepe NFT",
    image: "https://i.imgur.com/BmoA5Ui.jpeg",
    weight: 2,
  },
];

// Ссылка на GIF, который должен появляться при старте спина (с зелёным фоном):
const SPIN_GIF_URL =
  "https://s4.ezgif.com/tmp/ezgif-4a73d92325fcc3.gif"; // появится поверх, фон будет «пробит»

// Настройки хромакей-фильтра (подбирайте, если оттенок зелёного другой)
const CHROMA_KEY = {
  r: 0,
  g: 255,
  b: 0,
  threshold: 120, // чем больше, тем агрессивнее удаляет оттенки зелёного
};

// ------------------------------ УТИЛИТЫ БАЛАНСА ------------------------------
function getBalance(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem("stars_balance");
  return raw ? parseInt(raw, 10) : 500; // стартовый баланс для теста
}

function setBalance(v: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem("stars_balance", String(v));
}

function award(delta: number) {
  const cur = getBalance();
  const next = cur + delta;
  setBalance(next);
}

function canSpend(cost: number): boolean {
  return getBalance() >= cost;
}

function spend(cost: number) {
  award(-cost);
}

// Вытягиваем приз по весам (чем больше weight, тем выше шанс)
function weightedRandomPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let rnd = Math.random() * total;
  for (const p of PRIZES) {
    if ((rnd -= p.weight) <= 0) return p;
  }
  return PRIZES[0];
}

// ------------------------------ ХРОМАКЕЙ GIF ОВЕРЛЕЙ ------------------------------
const ChromaGifOverlay: React.FC<{
  src: string;
  visible: boolean;
  onFinish?: () => void;
  durationMs?: number; // сколько показывать (по умолчанию ~2.2с)
}> = ({ src, visible, onFinish, durationMs = 2200 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const drawFrame = useCallback((ts: number) => {
    if (!visible) return;
    if (!startRef.current) startRef.current = ts;
    const elapsed = ts - startRef.current!;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    // Рисуем GIF (браузер сам двигает кадры у <img>, мы просто копируем текущий кадр)
    const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight) * 0.9;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const x = (W - w) / 2;
    const y = (H - h) / 2;

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, x, y, w, h);

    // Хромакей: делаем «почти зелёные» пиксели прозрачными
    const frame = ctx.getImageData(0, 0, W, H);
    const data = frame.data;
    const { r: kr, g: kg, b: kb, threshold } = CHROMA_KEY;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Евклидово расстояние до ключевого зелёного
      const dr = r - kr;
      const dg = g - kg;
      const db = b - kb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < threshold) {
        data[i + 3] = 0; // прозрачность
      }
    }
    ctx.putImageData(frame, 0, 0);

    if (elapsed >= durationMs) {
      // Завершаем показ
      if (onFinish) onFinish();
      return;
    }
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [visible, onFinish, durationMs]);

  useEffect(() => {
    if (!visible) return;
    startRef.current = null;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, drawFrame]);

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
        zIndex: 9999,
      }}
    >
      {/* Скрытая картинка-источник кадров */}
      <img
        ref={imgRef}
        src={src}
        alt="spin"
        style={{ position: "fixed", left: -9999, top: -9999, pointerEvents: "none" }}
        crossOrigin="anonymous"
      />
      <canvas ref={canvasRef} />
    </div>
  );
};

// ------------------------------ КОЛЕСО РУЛЕТКИ ------------------------------
const Wheel: React.FC<{
  items: typeof PRIZES;
  spinning: boolean;
  onSpinEnd: (index: number) => void;
  spinKey: number; // для перезапуска CSS-анимаций
}> = ({ items, spinning, onSpinEnd, spinKey }) => {
  const size = 360; // диаметр колеса (px)
  const radius = size / 2;
  const segCount = items.length;
  const segAngle = (2 * Math.PI) / segCount;

  const [targetRotation, setTargetRotation] = useState(0);

  // Вычисляем случайный таргет-угол в градусах так, чтобы стрелка указывала на выбранный индекс
  const pickRotationForIndex = useCallback((idx: number) => {
    const segmentArc = 360 / segCount;
    // Центральный угол сегмента под стрелкой (стрелка смотрит вверх = 0deg)
    const segmentCenterDeg = idx * segmentArc + segmentArc / 2;
    // Делаем несколько полных оборотов + приходим к центру сегмента
    const rounds = 4 + Math.floor(Math.random() * 3); // 4–6 оборотов
    const finalDeg = rounds * 360 + (360 - segmentCenterDeg);
    setTargetRotation(finalDeg);
  }, [segCount]);

  // Слушаем окончание анимации
  const wheelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    const onEnd = () => {
      // По текущему повороту вычислим индекс результата
      const deg = targetRotation % 360;
      const segmentArc = 360 / segCount;
      // Стрелка сверху; 0deg указывает на сегмент с центром 0deg → пересчитаем в индекс
      const centerDeg = (360 - deg) % 360;
      const idx = Math.floor((centerDeg + segmentArc / 2) / segmentArc) % segCount;
      onSpinEnd(idx);
    };
    el.addEventListener("transitionend", onEnd);
    return () => el.removeEventListener("transitionend", onEnd);
  }, [onSpinEnd, segCount, targetRotation]);

  // Когда начинается новый спин, заранее фиксируем rotation под выбранный индекс
  useEffect(() => {
    if (!spinning) return;
    // на старте мы ещё не знаем индекс, его назначит родитель через spinKey → noop здесь
  }, [spinning]);

  // Рисуем сегменты SVG
  const segments = useMemo(() => {
    const r = radius;
    const cx = r, cy = r;
    return items.map((it, i) => {
      const startAngle = i * segAngle - Math.PI / 2; // старт, сдвинутый так, чтобы 0 был сверху
      const endAngle = startAngle + segAngle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = segAngle > Math.PI ? 1 : 0;
      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      return (
        <g key={i}>
          <path d={path} fill={`hsl(${(i * 360) / segCount},70%,55%)`} stroke="#111" strokeWidth={1} />
          <text
            x={cx}
            y={cy}
            transform={`translate(0,-10) rotate(${(i * 360) / segCount}, ${cx}, ${cy})`}
            fontSize={12}
            textAnchor="middle"
            fill="#fff"
            style={{ pointerEvents: "none" }}
          >
            <tspan dy={-r * 0.6}>{it.label}</tspan>
          </text>
        </g>
      );
    });
  }, [items, radius, segAngle, segCount]);

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      {/* Стрелка */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: -10,
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "12px solid transparent",
          borderRight: "12px solid transparent",
          borderBottom: "20px solid #ffcc00",
          zIndex: 2,
          filter: "drop-shadow(0 2px 1px rgba(0,0,0,.4))",
        }}
      />

      <div
        ref={wheelRef}
        key={spinKey}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: "6px solid #222",
          overflow: "hidden",
          transform: `rotate(${targetRotation}deg)`,
          transition: "transform 3.2s cubic-bezier(.15,.85,.2,1)",
          boxShadow: "0 10px 30px rgba(0,0,0,.35) inset, 0 6px 20px rgba(0,0,0,.25)",
          background: "#111",
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments}
        </svg>
      </div>
    </div>
  );
};

// ------------------------------ СТРАНИЦА ------------------------------
const ObmenPage: React.FC = () => {
  const [balance, setBalanceState] = useState<number>(0);
  const [spinning, setSpinning] = useState(false);
  const [spinKey, setSpinKey] = useState(0);
  const [result, setResult] = useState<null | { idx: number; prize: (typeof PRIZES)[number] }>(null);
  const [showGif, setShowGif] = useState(false);
  const [nftWon, setNftWon] = useState<null | { label: string; image: string }>(null);

  useEffect(() => {
    const b = getBalance();
    setBalanceState(b);
  }, []);

  const doSpin = useCallback(() => {
    if (spinning) return;
    if (!canSpend(SPIN_COST)) {
      alert(`Недостаточно звёзд. Нужно ${SPIN_COST}.`);
      return;
    }

    // Списываем стоимость
    spend(SPIN_COST);
    const newBal = getBalance();
    setBalanceState(newBal);

    // Выбираем приз и подготавливаем колесо
    const prize = weightedRandomPrize();
    const idx = PRIZES.indexOf(prize);

    // Запускаем колесо (через смену ключа сбрасываем предыдущую анимацию)
    setSpinKey((k) => k + 1);
    setSpinning(true);
    setResult({ idx, prize });

    // Запускаем GIF-оверлей с хромакеем
    setShowGif(true);
  }, [spinning]);

  const handleSpinEnd = useCallback(
    (/* idxFromWheel */ _idxFromWheel: number) => {
      setSpinning(false);
      setShowGif(false);
      if (!result) return;

      if (result.prize.type === "stars") {
        award(result.prize.value);
        setBalanceState(getBalance());
      } else if (result.prize.type === "nft") {
        // Здесь можно вызвать ваш API фиксации NFT-приза.
        setNftWon({ label: result.prize.label, image: (result.prize as any).image });
      }
    },
    [result]
  );

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "radial-gradient(1200px 800px at 50% -20%, #1f2937, #0b0f1a)",
        color: "#e5e7eb",
        padding: "24px 16px 64px",
      }}
    >
      <style>{`
        :root { --card: #101420; --accent: #4ade80; --muted:#9ca3af; }
        .btn { padding: 12px 18px; border-radius: 12px; border: 1px solid #2a3346; background: #121a2b; color: #e5e7eb; font-weight: 600; }
        .btn[disabled] { opacity:.5; cursor:not-allowed; }
        .btn-primary { background: linear-gradient(180deg,#1f9d5c,#17894f); border-color:#0f6b3d; }
        .card { background: var(--card); border: 1px solid #243045; border-radius: 18px; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
        .row { display:flex; gap:16px; align-items:center; justify-content:center; flex-wrap:wrap; }
      `}</style>

      <div className="row" style={{ marginBottom: 18 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>Баланс</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{balance.toLocaleString("ru-RU")} ⭐</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>Стоимость спина</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {SPIN_COST} ⭐
          </div>
        </div>
      </div>

      <Wheel items={PRIZES} spinning={spinning} spinKey={spinKey} onSpinEnd={handleSpinEnd} />

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <button className="btn btn-primary" onClick={doSpin} disabled={spinning || !canSpend(SPIN_COST)}>
          {spinning ? "Крутим…" : "Крутить рулетку"}
        </button>
      </div>

      {/* Легенда призов */}
      <div className="card" style={{ maxWidth: 680, margin: "24px auto 0", padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Призы</div>
        <ul style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
          {PRIZES.map((p, i) => (
            <li key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "#0f1422", borderRadius: 10 }}>
              <span>{p.label}</span>
              {"weight" in p && <span style={{ color: "var(--muted)">Шанс (вес): {p.weight}</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* Модалка NFT выигрыша */}
      {nftWon && (
        <div
          onClick={() => setNftWon(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 520, width: "100%", padding: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{nftWon.label} 🎉</div>
            <img src={nftWon.image} alt={nftWon.label} style={{ width: "100%", borderRadius: 12 }} />
            <p style={{ color: "var(--muted)", marginTop: 10 }}>
              Поздравляем! Сохраните скрин или свяжите этот приз с вашим аккаунтом в бэкенде.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button className="btn" onClick={() => setNftWon(null)}>Ок</button>
            </div>
          </div>
        </div>
      )}

      {/* GIF-оверлей с хромакеем во время спина */}
      <ChromaGifOverlay src={SPIN_GIF_URL} visible={showGif} onFinish={() => setShowGif(false)} />
    </div>
  );
};

export default ObmenPage;
