"use client";

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

/** Универсальный способ получить tg_id (Telegram → URL → localStorage → ручной ввод) */
function useTg() {
  const [tgId, setTgId] = useState<number | null>(null);
  const [initData, setInitData] = useState<string>("");

  useEffect(() => {
    const w: any = typeof window !== "undefined" ? window : undefined;
    const tg = w?.Telegram?.WebApp;

    try { tg?.ready?.(); tg?.expand?.(); } catch {}

    const fromTg = tg?.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : "";
    const params = new URLSearchParams(w?.location?.search || "");
    const fromQuery = params.get("debug_tg_id") || params.get("tg_id") || "";
    const fromLS = (() => { try { return localStorage.getItem("debug_tg_id") || ""; } catch { return ""; } })();
    const fromEnv = (w?.process?.env?.NEXT_PUBLIC_DEBUG_TG_ID as string) || "";

    const pick = [fromTg, fromQuery, fromLS, fromEnv].find(v => /^\d+$/.test(v || ""));
    if (pick) {
      setTgId(Number(pick));
      try { localStorage.setItem("debug_tg_id", String(pick)); } catch {}
    }
    setInitData(tg?.initData || "");
  }, []);

  return { tgId, setTgId, initData };
}

export default function Roulette() {
  const { tgId, setTgId, initData } = useTg();

  const [agreed, setAgreed] = useState(false);
  const [agreeConfirmed, setAgreeConfirmed] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Prize | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Согласие — один раз
  useEffect(() => {
    try { if (localStorage.getItem("roulette_agreed") === "1") setAgreeConfirmed(true); } catch {}
  }, []);

  const controls = useAnimation();
  const trackRef = useRef<HTMLDivElement>(null);

  // Баланс
  const fetchBalance = async () => {
    if (!tgId) { setError("Не удалось определить Telegram ID"); return; }
    const r = await fetch(`/api/my-balance?tg_id=${tgId}`);
    const j = await r.json();
    const src = j?.balance ? j.balance : j;
    setBalance(Number(src?.stars || 0));
  };
  useEffect(() => { if (tgId) fetchBalance(); }, [tgId]);

  // Лента карточек
  const track = useMemo(() => Array(8).fill(0).flatMap(() => PRIZES), []);

  // Спин
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
        headers: {
          "Content-Type": "application/json",
          "x-init-data": initData || "",
          "x-tg-id": String(tgId || ""),       // 👈 приоритетный источник для API
        },
        body: JSON.stringify({ tg_id: String(tgId || "") }),
      });
      const json = await res.json().catch(() => ({} as any));

      // Явная обработка нехватки звёзд + подсказка с тем, что увидел сервер
      if (res.status === 400 && json?.error === "NOT_ENOUGH_STARS") {
        setError(`Недостаточно звёзд: сервер видит ${json?.balance ?? "0"} ⭐ на ID ${tgId}.`);
        await fetchBalance();
        return;
      }
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
      setResult(clientPrize || null);
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
        <p className="text-slate-500 text-sm mt-1">
          Стоимость — <b>{COST} ⭐</b>
          {tgId && <span className="ml-2 text-xs text-slate-500">• ID: <b>{tgId}</b></span>}
          {balance !== null && (
            <span className={`ml-2 text-[11px] px-2 py-[2px] rounded-full ring-1 ${
              balance >= COST ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"
            }`}>
              баланс: {balance} ⭐
            </span>
          )}
        </p>

        {/* Если tg_id не найден — поле ручного ввода для теста в браузере */}
        {!tgId && (
          <div className="mt-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3">
            <div className="text-sm text-amber-800">Telegram ID не найден. Введите ID вручную для теста в браузере:</div>
            <div className="mt-2 flex gap-2">
              <input
                type="tel"
                inputMode="numeric"
                placeholder="например, 123456789"
                className="flex-1 h-10 px-3 rounded-xl ring-1 ring-slate-300"
                onChange={(e) => {
                  const v = e.target.value.replace(/\D+/g, "");
                  if (v) {
                    const n = Number(v);
                    if (!Number.isNaN(n)) {
                      setTgId(n);
                      try { localStorage.setItem("debug_tg_id", v); } catch {}
                    }
                  }
                }}
              />
              <button className="h-10 px-4 rounded-xl bg-blue-600 text-white">Ок</button>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              В Telegram-мини-приложении это поле не нужно — ID подтянется автоматически.
            </div>
          </div>
        )}

        {/* Согласие (один раз) */}
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
              onClick={() => { setAgreeConfirmed(true); try{ localStorage.setItem("roulette_agreed","1"); }catch{} }}
              disabled={!agreed}
            >
              Ознакомился
            </button>
          </div>
        )}

        {/* РУЛЕТКА */}
        <div className="mt-4 relative">
          {!agreeConfirmed && (
            <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <div className="text-center text-slate-600 text-sm px-4">Чтобы играть, отметьте галочку и нажмите «Ознакомился» выше</div>
            </div>
          )}

          <div className={`${!agreeConfirmed ? "pointer-events-none blur-[1px]" : ""}`}>
            {/* Лента карточек */}
            <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200 relative bg-white">
              <motion.div ref={trackRef} className="flex gap-3 p-3" animate={controls} initial={{ x: 0 }}>
                {Array(8).fill(0).flatMap(()=>PRIZES).map((p, i) => (
                  <div
                    key={i}
                    data-card
                    className="min-w-[128px] max-w-[128px] h-32 p-3 flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 shadow-md ring-1 ring-amber-300 relative overflow-hidden"
                  >
                    <span className="pointer-events-none absolute inset-0 opacity-35 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/60 via-transparent to-transparent" />
                    {p.kind === "stars" ? (
                      <div className="text-center">
                        <div className="text-3xl font-black tracking-wide">{p.label} ⭐</div>
                        <div className="text-xs text-slate-600 mt-1">изменение баланса</div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-xl mx-auto ring-1 ring-amber-300 shadow-sm bg-white overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={NFT_IMG} alt="NFT" className="w-full h-full object-contain" />
                        </div>
                        <div className="text-xs mt-1">Plush Pepe NFT</div>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
              {/* Индикатор */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-blue-600 drop-shadow" />
            </div>

            {/* Кнопки */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button className="h-11 rounded-xl ring-1 ring-slate-200 bg-white disabled:opacity-60" onClick={fetchBalance} disabled={busy}>
                Обновить баланс
              </button>
              <button
                className="h-11 rounded-xl bg-blue-600 text-white disabled:opacity-60"
                onClick={onSpin}
                disabled={busy || !agreeConfirmed || !tgId || (balance !== null && balance < COST)}
              >
                Крутить за {COST} ⭐
              </button>
            </div>
          </div>

          {/* Ошибки/подсказка */}
          {error && (
            <div className="text-sm text-red-600 mt-2">
              {error}
              {error.startsWith("Недостаточно звёзд") && (
                <div className="text-xs text-slate-500 mt-1">
                  Если у тебя звёзды есть — проверь, что ID совпадает, или введи его вручную выше.
                </div>
              )}
              {error === "Не удалось определить Telegram ID" && (
                <div className="text-xs text-slate-500 mt-1">
                  Открой страницу в Telegram-мини-приложении, добавь к URL <code>?debug_tg_id=123456789</code>,
                  или введи ID в поле — он сохранится для следующих запусков.
                </div>
              )}
            </div>
          )}

          {/* Результат */}
          {result && (
            <div className="mt-4 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-3">
              {result.kind === "stars" ? (
                <div>Результат: {result.label} ⭐. Новый баланс: {balance ?? "—"} ⭐</div>
              ) : (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={NFT_IMG} className="w-10 h-10 rounded-lg" alt="Pepe NFT" />
                  <div>Поздравляем! Вы получили <b>Plush Pepe NFT</b>. Свяжемся для выдачи приза.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Список призов с % и цветными бейджами */}
        <PrizeList />
      </div>

      {/* Фуллскрин GIF-оверлей (зелёный фон удаляем) */}
      <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/30 backdrop-blur-sm pointer-events-none roulette-overlay">
        <ChromaGif />
      </div>

      <style jsx global>{`
        body.roulette-overlay-open .roulette-overlay { display: flex; }
      `}</style>
    </section>
  );
}

// ——— GIF с удалением хромакея ———
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
      const i = imgRef.current; if (!i) return;
      const w = 320, h = 320; canvas.width = w; canvas.height = h;
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

// ——— Список призов ———
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
          const pct = CHANCES.find(c => c.key === (it.kind === "nft" ? it.label : it.label))?.pct ?? 0;
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
