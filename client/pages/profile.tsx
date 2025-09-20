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

function small(text?: string) {
  return text && text.trim() ? text : "—";
}

export default function Profile() {
  const [u, setU] = useState<TGUser | null>(null);
  const [linkStatus, setLinkStatus] = useState(
    "Открой через Telegram Mini App, чтобы связать профиль."
  );
  const [copyOk, setCopyOk] = useState(false);

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
          setLinkStatus("Связано с Telegram");
          // апсертим пользователя, но страницу не блокируем
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
        } else if (tries > 50) {
          clearInterval(t);
        }
      } catch {}
    }, 100);
    return () => clearInterval(t);
  }, []);

  const copyId = async () => {
    if (!u?.id) return;
    try {
      await navigator.clipboard.writeText(String(u.id));
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1400);
    } catch {}
  };

  const openInTG = () => {
    if (!u?.username) return;
    const tg = (window as any)?.Telegram?.WebApp;
    const url = `https://t.me/${u.username}`;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank");
  };

  // динамический градиент из темы Telegram (если есть)
  let from = "from-indigo-600",
    to = "to-blue-500";
  try {
    const tp = (window as any)?.Telegram?.WebApp?.themeParams;
    if (tp?.button_color) from = "";
    // оставляем дефолтный градиент, чтобы не переусложнять,
    // но при желании можно прокрасить фон по tp.button_color
  } catch {}

  return (
    <Layout title="Профиль — Reel Wallet">
      {/* Шапка */}
      <div className={`bg-gradient-to-br ${from} ${to} text-white rounded-b-3xl pb-10 pt-12`}>
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center gap-4">
            {u?.photo_url ? (
              <img
                src={u.photo_url}
                alt="avatar"
                className="w-16 h-16 rounded-full object-cover ring-2 ring-white/40"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                🙂
              </div>
            )}

            <div className="min-w-0">
              <div className="text-lg font-semibold truncate">
                {u ? `${u.first_name ?? ""} ${u?.last_name ?? ""}`.trim() || (u.username ? `@${u.username}` : "Пользователь")
                   : <Skeleton className="h-5 w-40" />}
              </div>
              <div className="text-sm/5 opacity-90 truncate">
                {u ? (u.username ? `@${u.username}` : "—") : <Skeleton className="h-4 w-24 mt-1" />}
              </div>
            </div>

            {u?.username && (
              <button
                onClick={openInTG}
                className="ml-auto text-[11px] bg-white/20 hover:bg-white/30 transition rounded-full px-3 py-1"
              >
                Написать в TG
              </button>
            )}
          </div>

          <div className="mt-4 text-xs opacity-90">
            {u ? <span className="text-white/90">Связано с Telegram</span> : linkStatus}
          </div>
        </div>
      </div>

      {/* Контент профиля */}
      <div className="max-w-md mx-auto px-4 -mt-6 space-y-6 relative z-10">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="font-semibold mb-3">Данные профиля</div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[11px] text-slate-500">ID</div>
              <div className="font-medium">{u ? u.id : <Skeleton className="h-4 w-20" />}</div>
              <button
                onClick={copyId}
                className="mt-2 text-[11px] text-slate-600 underline"
              >
                {copyOk ? "Скопировано ✓" : "Скопировать"}
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[11px] text-slate-500">Username</div>
              <div className="font-medium">
                {u ? small(u.username ? `@${u.username}` : "") : <Skeleton className="h-4 w-24" />}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[11px] text-slate-500">Имя</div>
              <div className="font-medium">
                {u ? small(u.first_name) : <Skeleton className="h-4 w-24" />}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[11px] text-slate-500">Фамилия</div>
              <div className="font-medium">
                {u ? small(u.last_name) : <Skeleton className="h-4 w-24" />}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[11px] text-slate-500">Язык</div>
              <div className="font-medium">
                {u ? small(u.language_code) : <Skeleton className="h-4 w-16" />}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[11px] text-slate-500">Премиум</div>
              <div className="font-medium">
                {u ? (u.is_premium ? "Telegram Premium ✓" : "—") : <Skeleton className="h-4 w-24" />}
              </div>
            </div>
          </div>
        </div>

        {/* Подсказка для не-TG запуска */}
        {!u && (
          <div className="text-[12px] text-slate-500 text-center pb-6">
            Запусти мини-приложение из Telegram, чтобы увидеть данные профиля.
          </div>
        )}
      </div>
    </Layout>
  );
}
