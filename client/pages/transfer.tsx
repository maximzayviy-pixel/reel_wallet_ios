// pages/transfer.tsx
"use client";

import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";
import { useEffect, useMemo, useRef, useState } from "react";

// Без внешних зависимостей: чек сохраняем как PNG при помощи Canvas API

type TgWebApp = {
  initData?: string;
  initDataUnsafe?: { user?: { id: number; username?: string; first_name?: string; last_name?: string; photo_url?: string } };
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: { impactOccurred: (style: "light" | "medium" | "heavy") => void };
  showAlert?: (msg: string) => void;
};

type DoneInfo = { toId: string; stars: number; note?: string; ts: number; tx: string };

export default function Transfer() {
  const [me, setMe] = useState<{ id: number; username?: string } | null>(null);
  const [balanceStars, setBalanceStars] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [toId, setToId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const tg: TgWebApp | null = useMemo(
    () => (typeof window !== "undefined" ? (window as any).Telegram?.WebApp || null : null),
    []
  );
  const pollingRef = useRef<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // --- helpers
  const starsNum = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }, [amount]);

  const rubEq = useMemo(() => (starsNum > 0 ? (starsNum / 2).toFixed(2) : "0.00"), [starsNum]);

  const canSubmit = useMemo(() => {
    if (!me?.id) return false;
    if (!toId.trim()) return false;
    const idNum = Number(toId);
    if (!Number.isInteger(idNum) || idNum <= 0) return false;
    if (idNum === me.id) return false;
    if (starsNum <= 0) return false;
    if (balanceStars != null && starsNum > balanceStars) return false;
    return true;
  }, [me?.id, toId, starsNum, balanceStars]);

  const showAlert = (msg: string) => {
    if (tg?.showAlert) tg.showAlert(msg);
    else alert(msg);
  };

  const haptic = (style: "light" | "medium" | "heavy" = "light") => {
    try { tg?.HapticFeedback?.impactOccurred(style); } catch {}
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });

  const genTx = () =>
    `RW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const handleShareText = async (info: DoneInfo) => {
    const text = `Перевод выполнен в Reel Wallet

Сумма: ${info.stars} ⭐ (≈ ${(info.stars / 2).toFixed(2)} ₽)
Получатель: ${info.toId}
Комментарий: ${info.note || "—"}
Дата: ${formatDate(info.ts)}
Tx: ${info.tx}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Чек перевода — Reel Wallet", text });
      } else {
        await navigator.clipboard.writeText(text);
        showAlert("Чек скопирован в буфер обмена");
      }
    } catch {}
  };

  // Рендерим красивый PNG чека через Canvas API, без библиотек
  const downloadReceipt = async () => {
    if (!done) return;

    const W = 1080; // ширина изображения (px)
    const H = 1350; // высота (4:5 для соцсетей)
    const scale = Math.min(3, Math.max(2, Math.floor((window.devicePixelRatio || 2))));

    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);

    // Фон — синий градиент
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#e6f0ff");
    bg.addColorStop(0.55, "#e0f2fe");
    bg.addColorStop(1, "#dbeafe");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Радальные орбы
    const orb = (x: number, y: number, r: number, color: string, alpha=0.25) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    orb(W*0.85, H*0.2, 260, "#bae6fd");
    orb(W*0.15, H*0.85, 240, "#a5f3fc");

    // Сетка
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    const step = 28;
    for (let x = 0.5; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0.5; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Карточка
    const card = { x: 48, y: 72, w: W-96, h: H-180, r: 28 };
    // Тень
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;

    const roundRect = (x:number,y:number,w:number,h:number,r:number) => {
      ctx.beginPath();
      ctx.moveTo(x+r, y);
      ctx.arcTo(x+w, y,   x+w, y+h, r);
      ctx.arcTo(x+w, y+h, x,   y+h, r);
      ctx.arcTo(x,   y+h, x,   y,   r);
      ctx.arcTo(x,   y,   x+w, y,   r);
      ctx.closePath();
    };

    ctx.fillStyle = "rgba(255,255,255,0.96)";
    roundRect(card.x, card.y, card.w, card.h, card.r);
    ctx.fill();

    // Сброс тени
    ctx.shadowColor = "transparent";

    // Внутренние декоративные орбы на карточке
    orb(card.x + card.w - 140, card.y + 60, 140, "#dbeafe", 0.5);
    orb(card.x + 140, card.y + card.h - 140, 160, "#cffafe", 0.45);

    // Заголовок-статус (чип)
    const pad = 28;
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto";
    const chipH = 28, chipR = 14; const chipW = 172;
    ctx.fillStyle = "#ecfdf5"; // emerald-50
    ctx.strokeStyle = "#a7f3d0"; // emerald-200
    ctx.lineWidth = 1;
    roundRect(card.x + pad, card.y + pad, chipW, chipH, chipR);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#047857"; // emerald-700
    ctx.font = "bold 12px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("✅ Успешный перевод", card.x + pad + 12, card.y + pad + 18);

    // Дата
    ctx.fillStyle = "#64748b";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.textAlign = "right";
    ctx.fillText(formatDate(done.ts), card.x + card.w - pad, card.y + pad + 18);
    ctx.textAlign = "left";

    // Сумма
    ctx.fillStyle = "#0f172a"; // slate-900
    ctx.font = "700 64px system-ui, -apple-system, Segoe UI, Roboto";
    const amountText = `${done.stars}`;
    ctx.fillText(amountText, card.x + pad, card.y + 120);
    ctx.font = "28px system-ui, -apple-system, Segoe UI, Roboto";
    const ax = card.x + pad + ctx.measureText(amountText).width + 12;
    ctx.fillStyle = "#475569";
    ctx.fillText("⭐", ax, card.y + 110);
    ctx.fillStyle = "#64748b";
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(`≈ ${(done.stars / 2).toFixed(2)} ₽`, card.x + pad, card.y + 144);

    // Пары ключ-значение
    const row = (label:string, value:string, y:number) => {
      ctx.fillStyle = "#64748b"; ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto"; ctx.fillText(label, card.x + pad, y);
      ctx.fillStyle = "#0f172a"; ctx.font = "600 16px system-ui, -apple-system, Segoe UI, Roboto"; ctx.textAlign = "right"; ctx.fillText(value, card.x + card.w - pad, y);
      ctx.textAlign = "left";
    };
    const startY = card.y + 200;
    row("Отправитель", me?.username ? `@${me.username}` : String(me?.id ?? "—"), startY);
    row("Получатель", String(done.toId), startY + 34);
    if (done.note) row("Комментарий", String(done.note), startY + 68);
    row("Tx", done.tx, startY + (done.note ? 102 : 68));

    // Нижняя плашка
    ctx.fillStyle = "rgba(248,250,252,0.9)"; // slate-50
    const footH = 56; roundRect(card.x, card.y + card.h - footH, card.w, footH, 22); ctx.fill();
    ctx.fillStyle = "#64748b"; ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("Reel Wallet • Надёжные переводы ⭐", card.x + pad, card.y + card.h - 20);
    ctx.textAlign = "right"; ctx.fillText("Сделайте скриншот — это ваш чек", card.x + card.w - pad, card.y + card.h - 20); ctx.textAlign = "left";

    // Сохранение (поддержка iOS: открываем в новой вкладке)
    const dataUrl = canvas.toDataURL("image/png");
    const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
    if (isIOS) {
      window.open(dataUrl, "_blank");
    } else {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `reel-wallet-receipt-${done.tx}.png`;
      a.click();
    }
  };

  // --- balance
  const fetchBalance = async () => {
    try {
      const myId =
        tg?.initDataUnsafe?.user?.id ||
        (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (!myId) {
        setLoading(false);
        return;
      }
      setMe({ id: myId, username: tg?.initDataUnsafe?.user?.username });
      const res = await fetch(`/api/my-balance?tg_id=${myId}`);
      const json = await res.json();
      const src = json?.balance ? json.balance : json;
      setBalanceStars(Number(src?.stars || 0));
    } catch (e) {
      console.warn("fetchBalance error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    const onVisible = () => { if (document.visibilityState === "visible") fetchBalance(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", fetchBalance);
    pollingRef.current = setInterval(fetchBalance, 20000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", fetchBalance);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [tg]);

  // --- submit
  const submit = async () => {
    if (!canSubmit || !me?.id) return;
    setSubmitting(true);
    setDone(null);

    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-50 bg-black/40 flex items-center justify-center";
    overlay.innerHTML = `<div class=\"bg-white rounded-2xl px-6 py-4 text-center shadow animate-pulse\">Переводим ⭐…</div>`;
    document.body.appendChild(overlay);

    try {
      const res = await fetch("/api/transfer-stars", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": (tg as any)?.initData || "",
        },
        body: JSON.stringify({
          from_tg_id: me.id,
          to_tg_id: Number(toId),
          amount_stars: starsNum,
          note: note?.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || "TRANSFER_FAILED");
      haptic("medium");
      const now = Date.now();
      const info = { toId, stars: starsNum, note: note?.trim() || undefined, ts: now, tx: genTx() };
      setDone(info);
      setReceiptOpen(true);
      setAmount("");
      setNote("");
      fetchBalance();
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch (e: any) {
      haptic("light");
      showAlert(e?.message || "Ошибка перевода");
    } finally {
      overlay.remove();
      setSubmitting(false);
    }
  };

  // --- UI
  return (
    <Layout title="Перевод — Reel Wallet">
      <div className="max-w-md mx-auto px-4 pt-6 pb-8 space-y-6">
        {/* Hero */}
        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white rounded-2xl p-5 shadow-sm">
          <div className="text-sm/5 opacity-90">Перевод звёзд</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">Отправьте друзьям ⭐</div>
          <div className="mt-3 text-xs opacity-90">
            Текущий баланс:{" "}
            {loading ? (
              <span className="inline-block align-middle"><Skeleton className="h-4 w-16" /></span>
            ) : (
              <span className="font-medium">{balanceStars ?? 0} ⭐</span>
            )}{" "}
            (<span>{((balanceStars ?? 0) / 2).toFixed(2)} ₽</span>)
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          {/* To ID */}
          <div>
            <label className="text-[11px] text-slate-500">Получатель — Telegram ID</label>
            <div className="mt-1 flex gap-2">
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Например, 7086128174"
                value={toId}
                onChange={(e) => setToId(e.target.value.replace(/[^0-9]/g, ""))}
                className="flex-1 rounded-xl ring-1 ring-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-slate-300"
              />
              <button
                type="button"
                onClick={() => setToId(String(me?.id || ""))}
                className="text-xs px-3 py-2 rounded-xl ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Мой ID
              </button>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Узнать ID можно в мини-приложении: Профиль → «ID».</div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-[11px] text-slate-500">Сколько ⭐</label>
            <div className="mt-1 flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Например, 200"
                  className="w-full rounded-xl ring-1 ring-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-slate-300 pr-10"
                />
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">⭐</div>
              </div>
              <button
                type="button"
                onClick={() => setAmount(String(Math.max(0, (balanceStars ?? 0))))}
                className="text-xs px-3 py-2 rounded-xl ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Всё
              </button>
            </div>
            {/* Presets */}
            <div className="mt-2 flex flex-wrap gap-2">
              {[100, 200, 500, 1000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  className="text-xs rounded-full px-3 py-1 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  +{v} ⭐
                </button>
              ))}
            </div>
            {/* Conversion */}
            <div className="mt-2 text-xs text-slate-600">
              {starsNum > 0 ? (
                <>Эквивалент ≈ <span className="font-medium">{rubEq} ₽</span></>
              ) : (
                <>Введи количество звёзд, чтобы увидеть сумму в ₽</>
              )}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-[11px] text-slate-500">Комментарий (необязательно)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Например: за обед"
              maxLength={120}
              className="mt-1 w-full rounded-xl ring-1 ring-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-slate-300"
            />
            <div className="mt-1 text-[11px] text-slate-400">{note.length}/120</div>
          </div>

          {/* Hints / errors */}
          <div className="text-xs">
            {!me?.id && <div className="text-rose-600">Открой мини-приложение из Telegram, чтобы отправлять переводы.</div>}
            {me?.id && Number(toId || 0) === me.id && (
              <div className="text-rose-600">Нельзя переводить самому себе.</div>
            )}
            {balanceStars != null && starsNum > (balanceStars ?? 0) && (
              <div className="text-rose-600">Недостаточно ⭐ на балансе.</div>
            )}
          </div>

          {/* Submit */}
          <button
            disabled={!canSubmit || submitting}
            onClick={submit}
            className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm disabled:opacity-60"
          >
            {submitting ? "Отправляем…" : "Отправить ⭐"}
          </button>

          <div className="text-[11px] text-slate-500">Комиссия: 0 ⭐. Перевод мгновенный. Получатель увидит пополнение в своей истории.</div>
        </div>

        {/* Success — WOW чек: фуллскрин оверлей для скрина + кнопка скачать */}
        {receiptOpen && done && (
          <div className="fixed inset-0 z-50">
            {/* bg (не перехватывает клики) */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#e6f0ff] via-[#e0f2fe] to-[#dbeafe]" />
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(1200px_700px_at_0%_0%,rgba(59,130,246,0.20)_0%,transparent_60%),radial-gradient(1000px_600px_at_100%_100%,rgba(2,132,199,0.18)_0%,transparent_60%)]" />
            <div className="absolute inset-0 pointer-events-none opacity-[0.10] [background-image:linear-gradient(0deg,rgba(0,0,0,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.6)_1px,transparent_1px)] [background-size:28px_28px]" />

            {/* top controls */}
            <div className="absolute left-0 right-0 top-0 z-20 p-3 flex justify-end gap-2 pointer-events-auto">
              <button type="button" onClick={() => setReceiptOpen(false)} className="rounded-xl bg-white/90 backdrop-blur px-3 py-2 text-sm ring-1 ring-slate-200 hover:bg-white">Закрыть</button>
              <button type="button" onClick={downloadReceipt} className="rounded-xl bg-slate-900 text-white px-3 py-2 text-sm">Скачать как фото</button>
            </div>

            {/* card center */}
            <div className="relative h-full w-full flex items-center justify-center p-4 z-10 pointer-events-auto">
              <div ref={receiptRef} className="relative w-full max-w-[720px]">
                {/* aura */}
                <div aria-hidden className="pointer-events-none absolute -inset-2 rounded-[30px] blur-2xl opacity-80" style={{ background: "conic-gradient(from 180deg at 50% 50%, rgba(59,130,246,.35), rgba(2,132,199,.35), rgba(191,219,254,.35), rgba(59,130,246,.35))" }} />

                <div className="relative overflow-hidden rounded-[22px] bg-white shadow-xl ring-1 ring-slate-100">
                  {/* декоративный фон под контентом */}
                  <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute -top-28 -right-10 h-60 w-60 rounded-full bg-sky-100 blur-3xl" />
                    <div className="absolute -bottom-28 -left-10 h-60 w-60 rounded-full bg-cyan-100 blur-3xl" />
                    <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(0deg,rgba(0,0,0,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.6)_1px,transparent_1px)] [background-size:28px_28px]" />
                  </div>

                  {/* контент */}
                  <div className="relative z-10 p-6 sm:p-8">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2.5 py-1 text-xs font-medium">
                        <span>✅</span> Успешный перевод
                      </div>
                      <div className="text-xs text-slate-500">{formatDate(done.ts)}</div>
                    </div>

                    <div className="mt-5 flex items-end gap-3">
                      <div className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">{done.stars}</div>
                      <div className="mb-1 text-2xl text-slate-600">⭐</div>
                    </div>
                    <div className="text-sm text-slate-500">≈ {(done.stars / 2).toFixed(2)} ₽</div>

                    <div className="mt-5 grid gap-2 text-[15px]">
                      <div className="flex items-center justify-between"><span className="text-slate-500">Отправитель</span><span className="font-medium">{me?.username ? `@${me.username}` : me?.id}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-500">Получатель</span><span className="font-medium">{done.toId}</span></div>
                      {done.note && (<div className="flex items-start justify-between gap-6"><span className="text-slate-500">Комментарий</span><span className="font-medium max-w-[60%] text-right">{done.note}</span></div>)}
                      <div className="flex items-center justify-between"><span className="text-slate-500">Tx</span><span className="font-mono text-[13px]">{done.tx}</span></div>
                    </div>
                  </div>

                  <div className="relative z-10 bg-slate-50/60 px-6 py-4 text-[12px] text-slate-500 flex items-center justify-between rounded-b-[22px]">
                    <span>Reel Wallet • Надёжные переводы ⭐</span>
                    <span>Сделайте скриншот — это ваш чек</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
