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

export default function Transfer() {
  const [me, setMe] = useState<{ id: number; username?: string } | null>(null);
  const [balanceStars, setBalanceStars] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [toId, setToId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { toId: string; stars: number }>(null);

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
      setDone({ toId, stars: starsNum });
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

        {/* Success card */}
        {done && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-100">
            <div className="text-emerald-600 font-semibold">Перевод выполнен ✅</div>
            <div className="mt-1 text-sm">
              {done.stars} ⭐ отправлено пользователю <span className="font-mono">{done.toId}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <a href="/history" className="flex-1 text-center rounded-xl ring-1 ring-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                История
              </a>
              <a href="/" className="flex-1 text-center rounded-xl bg-slate-900 text-white px-3 py-2 text-sm">
                На главную
              </a>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
