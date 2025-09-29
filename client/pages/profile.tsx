"use client";

import Link from "next/link";
import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type TGUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};
type RoleRow = { role?: string | null };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Profile() {
  const [u, setU] = useState<TGUser | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [role, setRole] = useState("user");

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

          fetch("/api/verify-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tg_id: user.id }),
          })
            .then((r) => r.json())
            .then((j) => setIsVerified(!!j?.verified))
            .catch(() => {});

          supabase
            .from("users")
            .select("role")
            .eq("tg_id", user.id)
            .maybeSingle()
            .then(({ data }) => setRole((data as RoleRow)?.role || "user"));
        } else if (tries > 60) clearInterval(t);
      } catch {}
    }, 100);
    return () => clearInterval(t);
  }, []);

  return (
    <Layout title="Профиль — Reel Wallet">
      <div className="min-h-[100dvh] bg-gradient-to-br from-[#f0f6ff] via-[#e7f0ff] to-[#e6f7ff]">
        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white rounded-b-3xl pb-10 pt-12 relative z-10">
          <div className="max-w-md mx-auto px-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/40 bg-white/20 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {u?.photo_url ? <img src={u.photo_url} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-2xl">🙂</span>}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">
                  {u ? (
                    `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || (u.username ? `@${u.username}` : "Пользователь")
                  ) : (
                    <Skeleton className="h-5 w-40" />
                  )}
                </div>
                <div className="text-sm opacity-90 truncate">
                  {u ? (u.username ? `@${u.username}` : "—") : <Skeleton className="h-4 w-24 mt-1" />}
                </div>
              </div>
              <button
                onClick={() => {
                  const tg = (window as any)?.Telegram?.WebApp;
                  const url = "https://t.me/ReelWalet";
                  if (tg?.openTelegramLink) tg.openTelegramLink(url);
                  else window.open(url, "_blank");
                }}
                className="ml-auto text-[11px] bg-white/20 hover:bg-white/30 transition rounded-full px-3 py-1"
              >
                Поддержка
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 -mt-6 space-y-6 relative z-0 pb-28">
          {/* Профилька */}
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
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                    не верифицирован
                  </span>
                )
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-[11px] text-slate-500">ID</div>
                <div className="font-medium">{u ? u.id : <Skeleton className="h-4 w-20" />}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-[11px] text-slate-500">Username</div>
                <div className="font-medium">{u ? (u.username ? `@${u.username}` : "—") : <Skeleton className="h-4 w-24" />}</div>
              </div>
            </div>
          </div>

          {/* KYC в профиле — только кнопка */}
          {u && !isVerified && (
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <div className="font-semibold">Верификация личности</div>
              <p className="text-sm text-slate-600">
                Для вывода средств пройди KYC: фото лица, фото документа и короткое видео.
              </p>
              <Link
                href="/kyc"
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white block text-center"
              >
                Пройти KYC
              </Link>
            </div>
          )}

          {/* Админ переходы, остальное — как у тебя */}
          {role === "admin" && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Админка</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Link href="/admin" className="rounded-xl ring-1 ring-slate-200 px-3 py-2 text-center hover:bg-slate-50">
                  Открыть админку
                </Link>
                <Link href="/history" className="rounded-xl ring-1 ring-slate-200 px-3 py-2 text-center hover:bg-slate-50">
                  История заявок
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
