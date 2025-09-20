// pages/profile.tsx
"use client";

import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";

type TGUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
};

export default function Profile() {
  const [u, setU] = useState<TGUser | null>(null);
  const [status, setStatus] = useState("Открой через Telegram Mini App, чтобы связать профиль.");
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [loadingVerify, setLoadingVerify] = useState(false);

  // Подтягиваем TG-профиль + апсертим в БД
  useEffect(() => {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      try {
        const tg = (window as any)?.Telegram?.WebApp;
        const user: TGUser | undefined = tg?.initDataUnsafe?.user;
        if (user?.id) {
          clearInterval(t);
          setU(user);
          setStatus("Связано с Telegram");

          fetch("/api/auth-upsert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tg_id: user.id,
              username: user.username,
              first_name: user.first_name,
              last_name: user.last_name,
            }),
          }).catch(() => {});

          // тянем флаг верификации
          fetch("/api/verify-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tg_id: user.id }),
          })
            .then(r => r.json())
            .then(j => setIsVerified(!!j?.verified))
            .catch(()=>{});
        } else if (tries > 60) {
          clearInterval(t);
        }
      } catch {}
    }, 100);
    return () => clearInterval(t);
  }, []);

  const copyId = async () => {
    if (!u?.id) return;
    try { await navigator.clipboard.writeText(String(u.id)); } catch {}
  };

  const openTG = () => {
    if (!u?.username) return;
    const tg = (window as any)?.Telegram?.WebApp;
    const url = `https://t.me/${u.username}`;
    if (tg?.openTelegramLink) tg.openTelegramLink(url); else window.open(url, "_blank");
  };

  const buyVerify = async () => {
    if (!u?.id) return;
    setLoadingVerify(true);
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      const r = await fetch("/api/buy-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tg_id: u.id }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "INVOICE_FAILED");
      // открываем звёздный инвойс
      if (tg?.openInvoice) tg.openInvoice(j.link);
      else if (tg?.openTelegramLink) tg.openTelegramLink(j.link);
      else window.open(j.link, "_blank");
    } catch (e:any) {
      alert(e.message || "Ошибка");
    } finally {
      setLoadingVerify(false);
    }
  };

  return (
    <Layout title="Профиль — Reel Wallet">
      {/* Шапка с градиентом */}
      <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white rounded-b-3xl pb-10 pt-12">
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center gap-4">
            {/* Аватар с градиентным ореолом */}
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 blur opacity-70"></div>
              <div className="relative w-18 h-18">
                {u?.photo_url ? (
                  <img
                    src={u.photo_url}
                    alt="avatar"
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-white/40"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl">🙂</div>
                )}
                {/* Бейдж верификации (инста-стиль) */}
                {isVerified && (
                  <span
                    title="Верифицирован"
                    className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-md"
                  >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-white text-[12px] font-bold">
                      ✓
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div className="min-w-0">
              <div className="text-lg font-semibold truncate">
                {u
                  ? `${u.first_name ?? ""} ${u?.last_name ?? ""}`.trim() ||
                    (u.username ? `@${u.username}` : "Пользователь")
                  : <Skeleton className="h-5 w-40" />}
              </div>
              <div className="text-sm opacity-90 truncate">
                {u ? (u.username ? `@${u.username}` : "—") : <Skeleton className="h-4 w-24 mt-1" />}
              </div>
            </div>

            {u?.username && (
              <button
                onClick={openTG}
                className="ml-auto text-[11px] bg-white/20 hover:bg-white/30 transition rounded-full px-3 py-1"
              >
                Написать в TG
              </button>
            )}
          </div>

          <div className="mt-4 text-xs opacity-90">
            {u ? "Связано с Telegram" : status}
          </div>
        </div>
      </div>

      {/* Карточка с полями профиля + верификация */}
      <div className="max-w-md mx-auto px-4 -mt-6 space-y-6 relative z-10">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Данные профиля</div>
            {u && (
              isVerified ? (
                <span className="inline-flex items-center gap-2 text-sm text-emerald-600">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-white text-[11px] font-bold">✓</span>
                  Верифицирован
                </span>
              ) : (
                <button
                  onClick={buyVerify}
                  disabled={loadingVerify}
                  className="text-sm bg-slate-900 text-white rounded-full px-3 py-1 disabled:opacity-60"
                >
                  {loadingVerify ? "Создаю..." : "Купить верификацию — 1000⭐"}
                </button>
              )
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[11px] text-slate-500">ID</div>
              <div className="font-medium">{u ? u.id : <Skeleton className="h-4 w-20" />}</div>
              <button onClick={copyId} className="mt-2 text-[11px] text-slate-600 underline">
                Скопировать
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[11px] text-slate-500">Username</div>
              <div className="font-medium">{u ? (u.username ? `@${u.username}` : "—") : <Skeleton className="h-4 w-24" />}</div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[11px] text-slate-500">Имя</div>
              <div className="font-medium">{u ? (u.first_name || "—") : <Skeleton className="h-4 w-24" />}</div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[11px] text-slate-500">Фамилия</div>
              <div className="font-medium">{u ? (u.last_name || "—") : <Skeleton className="h-4 w-24" />}</div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[11px] text-slate-500">Язык</div>
              <div className="font-medium">{u ? (u.language_code || "—") : <Skeleton className="h-4 w-16" />}</div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[11px] text-slate-500">Premium</div>
              <div className="font-medium">{u ? (u.is_premium ? "Telegram Premium ✓" : "—") : <Skeleton className="h-4 w-24" />}</div>
            </div>
          </div>
        </div>

        {!u && (
          <div className="text-[12px] text-slate-500 text-center pb-6">
            Запусти мини-приложение из Telegram, чтобы увидеть данные профиля.
          </div>
        )}
      </div>
    </Layout>
  );
}
