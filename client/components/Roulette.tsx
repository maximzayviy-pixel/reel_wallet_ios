
// components/Roulette.tsx — clean rewrite for stable layout
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";

type Prize =
  | { kind: "stars"; label: string; value: number }
  | { kind: "nft"; label: string; image: string };

const AGREEMENT_URL = "https://telegra.ph/Polzovatelskoe-soglashenie-Game-Reel-Wallet-09-29";
const GIF_URL = "https://s4.ezgif.com/tmp/ezgif-4a73d92325fcc3.gif";
const NFT_IMG = "https://i.imgur.com/BmoA5Ui.jpeg";
const COST = 15;

const PRIZES: Prize[] = [
  { kind: "stars", label: "+3", value: 3 },
  { kind: "stars", label: "+5", value: 5 },
  { kind: "stars", label: "+10", value: 10 },
  { kind: "stars", label: "+15", value: 15 },
  { kind: "stars", label: "+50", value: 50 },
  { kind: "stars", label: "+100", value: 100 },
  { kind: "stars", label: "+1000", value: 1000 },
  { kind: "nft", label: "Plush Pepe NFT", image: NFT_IMG },
];

function useTg() {
  const [tgId, setTgId] = useState<number | null>(null);
  const [initData, setInitData] = useState<string>("");
  useEffect(() => {
    const w: any = typeof window !== "undefined" ? window : undefined;
    const tg = w?.Telegram?.WebApp;
    const id = tg?.initDataUnsafe?.user?.id;
    if (id) setTgId(Number(id));
    setInitData(tg?.initData || "");
  }, []);
  return { tgId, initData };
}

export default function Roulette() {
  const { tgId, initData } = useTg();
  const [agreed, setAgreed] = useState(false);
  const [agreeConfirmed, setAgreeConfirmed] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Prize | null>(null);
  const [error, setError] = useState<string | null>(null);

  // persist one-time agreement
  useEffect(()=>{
    try{
      const v = typeof window !== "undefined" ? window.localStorage.getItem("roulette_agreed") : null;
      if (v === "1") setAgreeConfirmed(true);
    }catch{}
  },[]);

  const controls = useAnimation();
  const trackRef = useRef<HTMLDivElement>(null);

  // fetch balance
  const fetchBalance = async () => {
    if (!tgId) return;
    try {
      const r = await fetch(`/api/my-balance?tg_id=${tgId}`);
      const j = await r.json();
      const src = j?.balance ? j.balance : j;
      setBalance(Number(src?.stars || 0));
    } catch {}
  };
  useEffect(() => { fetchBalance(); }, [tgId]);

  const track = useMemo(() => Array(8).fill(0).flatMap(() => PRIZES), []);

  const onSpin = async () => {
    setError(null);
    if (!agreeConfirmed) { setError("Подтвердите ознакомление с соглашением."); return; }
    if (!tgId) { setError("Telegram WebApp не инициализирован."); return; }
    if (balance !== null && balance < COST) { setError("Недостаточно звёзд для игры."); return; }

    try {
      setBusy(true);
      document.body.classList.add("roulette-overlay-open");
      const res = await fetch("/api/roulette-spin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-init-data": initData || "",
        },
        body: JSON.stringify({ tg_id: tgId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json?.error || "Ошибка спина"); return; }

      const p = json?.prize;
      let clientPrize: Prize | null = null;
      if (p?.type === "nft") clientPrize = { kind: "nft", label: "Plush Pepe NFT", image: NFT_IMG };
      else if (typeof p?.value === "number") clientPrize = { kind: "stars", label: `+${p.value}`, value: p.value };
      if (!clientPrize) clientPrize = { kind: "stars", label: "+5", value: 5 };

      const idx = track.findIndex(q => q.kind === clientPrize!.kind && (q.kind === "nft" ? (q as any).label === clientPrize!.label : (q as any).value === (clientPrize as any).value));
      const baseIndex = idx >= 0 ? idx : 3;
      const finalIndex = baseIndex + 24 + Math.floor(Math.random() * 12);

      const card = trackRef.current?.querySelector<HTMLDivElement>("[data-card]");
      const cardW = card?.offsetWidth || 128;
      const gap = 12;
      const targetX = -(finalIndex * (cardW + gap));

      await controls.start({ x: targetX, transition: { duration: 3.6, ease: [0.12, 0.6, 0.04, 1] } });
      setResult(clientPrize);
      setBalance(Number(json?.balance ?? balance));
    } finally {
      setBusy(false);
      setTimeout(() => document.body.classList.remove("roulette-overlay-open"), 600);
    }
  };

  return (
    <section className="mt-6">
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
        <h2 className="text-lg font-semibold">Рулетка</h2>
        <p className="text-slate-500 text-sm mt-1">Стоимость игры — <b>{COST} ⭐</b>.</p>

        {!agreeConfirmed && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" className="mt-1" checked={agreed} onChange={(e)=>setAgreed(e.target.checked)} />
              <span className="text-sm text-slate-600">
                Я ознакомился(-ась) с{" "}
                <a className="text-blue-600 underline" href={AGREEMENT_URL} target="_blank" rel="noreferrer">пользовательским соглашением</a>
                {" "}и принимаю условия.
              </span>
            </label>
            <button
              className={`mt-3 h-10 w-full rounded-xl ${agreed ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"} disabled:opacity-60`}
              onClick={() => { setAgreeConfirmed(true); try{ window.localStorage.setItem("roulette_agreed","1"); }catch{} }}
              disabled={!agreed}
            >
              Ознакомился
            </button>
          </div>
        )}

        <div className="mt-4 relative">
          {!agreeConfirmed && (
            <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <div className="text-center text-slate-600 text-sm px-4">Чтобы играть, отметьте галочку и нажмите «Ознакомился» выше</div>
            </div>
          )}
          <div className={`${!agreeConfirmed ? "pointer-events-none blur-[1px]" : ""}`}>
            <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200 relative bg-white">
              <motion.div ref={trackRef} className="flex gap-3 p-3" animate={controls} initial={{ x: 0 }}>
                {Array(8).fill(0).flatMap(()=>PRIZES).map((p, i) => (
                  <div key={i} data-card className="min-w-[128px] max-w-[128px] h-32 p-3 flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 shadow-md ring-1 ring-amber-300 relative overflow-hidden">
                    <span className="pointer-events-none absolute inset-0 opacity-35 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/60 via-transparent to-transparent" />
                    {p.kind === "stars" ? (
                      <div className="text-center">
                        <div className="text-3xl font-black tracking-wide drop-shadow-sm">{p.label} ⭐</div>
                        <div className="text-xs text-slate-600 mt-1">изменение баланса</div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-xl mx-auto ring-1 ring-amber-300 shadow-sm bg-white overflow-hidden">
                          <img src={(p as any).image} alt="NFT" className="w-full h-full object-contain" />
                        </div>
                        <div className="text-xs mt-1">Plush Pepe NFT</div>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-blue-600 drop-shadow" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button className="h-11 rounded-xl ring-1 ring-slate-200 bg-white disabled:opacity-60" onClick={fetchBalance} disabled={busy}>Обновить баланс</button>
              <button className="h-11 rounded-xl bg-blue-600 text-white disabled:opacity-60" onClick={onSpin} disabled={busy || !agreeConfirmed}>
                Крутить за {COST} ⭐
              </button>
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}

        {result && (
          <div className="mt-4 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-3">
            {result.kind === "stars" ? (
              <div>Результат: {result.label} ⭐. Новый баланс: {balance ?? "—"} ⭐</div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden ring-1 ring-amber-300 bg-white">
                  <img src={(result as any).image} className="w-full h-full object-contain" />
                </div>
                <div>Поздравляем! Вы получили <b>Plush Pepe NFT</b>. Свяжемся для выдачи приза.</div>
              </div>
            )}
          </div>
        )}

        <PrizeList />
      </div>

      <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/30 backdrop-blur-sm pointer-events-none roulette-overlay">
        <ChromaGif />
      </div>

      <style jsx global>{`
        body.roulette-overlay-open .roulette-overlay { display: flex; }
      `}</style>
    </section>
  );
}

function ChromaGif() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = GIF_URL;
    imgRef.current = img;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const render = () => {
      const i = imgRef.current;
      if (!i) return;
      const w = 320, h = 320;
      canvas.width = w; canvas.height = h;
      ctx.drawImage(i, 0, 0, w, h);
      try {
        const frame = ctx.getImageData(0, 0, w, h);
        const data = frame.data;
        for (let p = 0; p < data.length; p += 4) {
          const r = data[p], g = data[p+1], b = data[p+2];
          if (g > 140 && g - r > 40 && g - b > 40) data[p+3] = 0;
        }
        ctx.putImageData(frame, 0, 0);
      } catch {}
      rafRef.current = requestAnimationFrame(render);
    };
    img.onload = () => { render(); };
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return <canvas ref={canvasRef} className="w-64 h-64 pointer-events-none" />;
}

function PrizeList() {
  const items = [
    { label: "+3", kind: "stars", note: "часто" },
    { label: "+5", kind: "stars", note: "часто" },
    { label: "+10", kind: "stars", note: "нормально" },
    { label: "+15", kind: "stars", note: "нормально" },
    { label: "+50", kind: "stars", note: "редко" },
    { label: "+100", kind: "stars", note: "редко" },
    { label: "+1000", kind: "stars", note: "очень редко" },
    { label: "Plush Pepe NFT", kind: "nft", note: "ультра-редко", image: NFT_IMG },
  ] as const;

  return (
    <div className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
      <h3 className="text-base font-semibold">Какие призы можно получить</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 px-3 py-3 ring-1 ring-slate-200 min-h-[64px] overflow-hidden">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center ring-1 ring-slate-200 bg-white">
              {it.kind === "nft" ? (
                <img src={(it as any).image} alt="NFT" className="w-full h-full object-contain" />
              ) : (
                <span className="text-lg font-extrabold">⭐</span>
              )}
            </div>
            <div className="flex-1">
              <div className="font-semibold">{it.kind==="stars" ? `${it.label} ⭐` : it.label}</div>
              <div className="text-xs text-slate-500">{it.note}</div>
            </div>
            <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-200 whitespace-nowrap">
              {it.note}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
