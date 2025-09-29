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

const CHANCES = [
  { key: "+3", pct: 30 },
  { key: "+5", pct: 24 },
  { key: "+10", pct: 18 },
  { key: "+15", pct: 12 },
  { key: "+50", pct: 8 },
  { key: "+100", pct: 5.5 },
  { key: "+1000", pct: 2.4 },
  { key: "Plush Pepe NFT", pct: 0.1 },
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

  useEffect(() => {
    try {
      if (window.localStorage.getItem("roulette_agreed") === "1") {
        setAgreeConfirmed(true);
      }
    } catch {}
  }, []);

  const controls = useAnimation();
  const trackRef = useRef<HTMLDivElement>(null);

  const fetchBalance = async () => {
    if (!tgId) { setError("Не удалось определить Telegram ID"); return; }
    const r = await fetch(`/api/my-balance?tg_id=${tgId}`);
    const j = await r.json();
    const src = j?.balance ? j.balance : j;
    setBalance(Number(src?.stars || 0));
  };
  useEffect(() => { fetchBalance(); }, [tgId]);

  const track = useMemo(() => Array(8).fill(0).flatMap(() => PRIZES), []);

  const onSpin = async () => {
    setError(null);
    if (!agreeConfirmed) { setError("Подтвердите ознакомление с соглашением."); return; }
    if (!tgId) { setError("Не удалось определить Telegram ID"); return; }
    if (balance !== null && balance < COST) { setError("Недостаточно звёзд для игры."); return; }

    setBusy(true);
    document.body.classList.add("roulette-overlay-open");
    try {
      const res = await fetch("/api/roulette-spin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-init-data": initData || "" },
        body: JSON.stringify({ tg_id: String(tgId) }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) { setError(json?.error || "Ошибка спина"); return; }

      const p = json?.prize;
      let clientPrize: Prize | null = null;
      if (p?.type === "nft") clientPrize = { kind: "nft", label: "Plush Pepe NFT", image: NFT_IMG };
      else if (typeof p?.value === "number") clientPrize = { kind: "stars", label: `+${p.value}`, value: p.value };

      const idx = track.findIndex(q =>
        q.kind === clientPrize!.kind &&
        (q.kind === "nft" ? (q as any).label === clientPrize!.label : (q as any).value === (clientPrize as any).value)
      );
      const baseIndex = idx >= 0 ? idx : 3;
      const finalIndex = baseIndex + 24 + Math.floor(Math.random() * 12);
      const cardW = trackRef.current?.querySelector<HTMLDivElement>("[data-card]")?.offsetWidth || 128;
      const targetX = -(finalIndex * (cardW + 12));

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
      {/* … остальная разметка рулетки … */}
      <PrizeList />
    </section>
  );
}

// Список призов с % и цветом
function PrizeList() {
  const colorForPct = (p: number) =>
    p >= 20 ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
    : p >= 10 ? "bg-amber-100 text-amber-800 ring-amber-200"
    : p >= 2  ? "bg-orange-100 text-orange-800 ring-orange-200"
    : "bg-rose-100 text-rose-800 ring-rose-200";

  return (
    <div className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
      <h3 className="text-base font-semibold">Какие призы можно получить</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {PRIZES.map((it, i) => {
          const key = it.kind === "nft" ? it.label : it.label;
          const pct = CHANCES.find(c => c.key === key)?.pct ?? 0;
          return (
            <div key={i} className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200 p-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center ring-1 ring-slate-200 bg-white">
                  {it.kind === "nft"
                    ? <img src={NFT_IMG} alt="NFT" className="w-full h-full object-contain" />
                    : <span className="text-xl font-extrabold">⭐</span>}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{it.kind === "stars" ? `${it.label} ⭐` : it.label}</div>
                </div>
                <span className={`text-[11px] px-2 py-1 rounded-full ring-1 ${colorForPct(pct)}`}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
