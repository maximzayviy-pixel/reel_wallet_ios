// pages/transfer.tsx
"use client";

import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";
import { useEffect, useMemo, useRef, useState } from "react";

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

  const tg: TgWebApp | null = useMemo(
    () => (typeof window !== "undefined" ? (window as any).Telegram?.WebApp || null : null),
    []
  );
  const pollingRef = useRef<any>(null);

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

  const handleShare = async (info: DoneInfo) => {
    const text = `Перевод выполнен в Reel Wallet\n\nСумма: ${info.stars} ⭐ (≈ ${(info.stars / 2).toFixed(2)} ₽)\nПолучатель: ${info.toId}\nКомментарий: ${info.note || "—"}\nДата: ${formatDate(info.ts)}\nTx: ${info.tx}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Чек перевода — Reel Wallet", text });
      } else {
        await navigator.clipboard.writeText(text);
        showAlert("Чек скопирован в буфер обмена");
      }
    } catch {}
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
    // автообновление при возврате
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchBalance();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", fetchBalance);
    // лёгкий пуллинг
    pollingRef.current = setInterval(fetchBalance, 20000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", fetchBalance);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tg]);

  // --- submit
  const submit = async () => {
    if (!canSubmit || !me?.id) return;
    setSubmitting(true);
    setDone(null);

    // оверлей
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-50 bg-black/40 flex items-center justify-center";
    overlay.innerHTML = `<div class="bg-white rounded-2xl px-6 py-4 text-center shadow animate-pulse">
      Переводим ⭐…
    </div>`;
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
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || "TRANSFER_FAILED");
      }
      haptic("medium");
      const now = Date.now();
      setDone({ toId, stars: starsNum, note: note?.trim() || undefined, ts: now, tx: genTx() });
      setAmount("");
      setNote("");
      // обновим баланс
      fetchBalance();
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
                onChange={(e) => setToId(e.target.value.replace(/[^\d]/g, ""))}
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
            <div className="mt-1 text-[11px] text-slate-500">
              Узнать ID можно в мини-приложении: Профиль → «ID».
            </div>
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

          <div className="text-[11px] text-slate-500">
            Комиссия: 0 ⭐. Перевод мгновенный. Получатель увидит пополнение в своей истории.
          </div>
        </div>

        {/* Success — WOW чек */}
        {done && (
          <div className="relative">
            {/* Aura */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-2 rounded-[28px] blur-2xl opacity-80"
              style={{
                background:
                  "conic-gradient(from 180deg at 50% 50%, rgba(59,130,246,.35), rgba(2,132,199,.35), rgba(191,219,254,.35), rgba(59,130,246,.35))",
              }}
            />

            <div className="relative overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-100">
              {/* top gradient */}
              <div className="absolute -top-28 -right-10 h-60 w-60 rounded-full bg-sky-100 blur-3xl" aria-hidden />
              <div className="absolute -bottom-28 -left-10 h-60 w-60 rounded-full bg-cyan-100 blur-3xl" aria-hidden />
              <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(0deg,rgba(0,0,0,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.6)_1px,transparent_1px)] [background-size:28px_28px]" aria-hidden />

              {/* body */}
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2.5 py-1 text-xs font-medium">
                    <span>✅</span> Успешный перевод
                  </div>
                  <div className="text-xs text-slate-500">{formatDate(done.ts)}</div>
                </div>

                {/* amount */}
                <div className="mt-4">
                  <div className="text-4xl font-bold tracking-tight bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
                    {done.stars} ⭐
                  </div>
                  <div className="text-sm text-slate-500">≈ {(done.stars / 2).toFixed(2)} ₽</div>
                </div>

                {/* details */}
                <div className="mt-4 grid gap-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-slate-500">Отправитель</span><span className="font-medium">{me?.username ? `@${me.username}` : me?.id}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Получатель</span><span className="font-medium">{done.toId}</span></div>
                  {done.note && (
                    <div className="flex items-start justify-between gap-6"><span className="text-slate-500">Комментарий</span><span className="font-medium max-w-[60%] text-right">{done.note}</span></div>
                  )}
                  <div className="flex items-center justify-between"><span className="text-slate-500">Tx</span><span className="font-mono text-[13px]">{done.tx}</span></div>
                </div>

                {/* divider */}
                <div className="my-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                <div className="flex items-center justify-between">
                  <a href="/history" className="text-sm rounded-xl ring-1 ring-slate-200 px-3 py-2 hover:bg-slate-50">История</a>
                  <div className="flex gap-2">
                    <button onClick={() => handleShare(done)} className="rounded-xl bg-slate-900 text-white text-sm px-3 py-2">
                      Поделиться
                    </button>
                    <a href="/" className="rounded-xl text-sm ring-1 ring-slate-200 px-3 py-2 hover:bg-slate-50">На главную</a>
                  </div>
                </div>
              </div>

              {/* footer ribbon */}
              <div className="bg-slate-50/60 px-5 py-3 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Reel Wallet • Надёжные переводы ⭐</span>
                <span>Сделайте скриншот — это ваш чек</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
