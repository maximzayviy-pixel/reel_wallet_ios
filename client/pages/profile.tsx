// pages/profile.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";
import { createClient } from "@supabase/supabase-js";

type TGUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
};
type RoleRow = { role?: string | null };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Profile() {
  const [u, setU] = useState<TGUser | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [role, setRole] = useState<string>("user");

  const [code, setCode] = useState("");
  const [promoState, setPromoState] = useState<null | { ok: boolean; msg: string }>(null);
  const disabledRedeem = useMemo(() => !code.trim() || !u?.id, [code, u?.id]);

  useEffect(() => {
    let tries = 0;
    let usersChannel: ReturnType<typeof supabase.channel> | null = null;

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

          usersChannel = supabase
            .channel(`users-role-${user.id}`)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "users", filter: `tg_id=eq.${user.id}` },
              (payload: any) => setRole(payload?.new?.role || payload?.old?.role || "user")
            )
            .subscribe();
        } else if (tries > 60) {
          clearInterval(t);
        }
      } catch {}
    }, 100);

    return () => {
      clearInterval(t);
      if (usersChannel) supabase.removeChannel(usersChannel);
    };
  }, []);

  const redeem = async () => {
    if (!u?.id || !code.trim()) return;
    setPromoState(null);
    try {
      const r = await fetch("/api/redeem-promocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tg_id: u.id, code: code.trim() }),
      });
      const j = await r.json();
      if (!j?.ok) {
        setPromoState({ ok: false, msg: j?.error || "Промокод не принят" });
      } else {
        const bonus = j.bonus ?? j.amount ?? "";
        const cur = j.currency ?? (j.isStars ? "⭐" : "₽");
        setPromoState({ ok: true, msg: `Зачислено: ${bonus} ${cur}` });
        setCode("");
      }
    } catch {
      setPromoState({ ok: false, msg: "Ошибка сети" });
    }
  };

  return (
    <Layout title="Профиль — Reel Wallet">
      <div className="min-h-[100dvh] bg-gradient-to-br from-[#f0f6ff] via-[#e7f0ff] to-[#e6f7ff]">
        {/* header */}
        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white rounded-b-3xl pb-10 pt-12 relative z-10">
          <div className="max-w-md mx-auto px-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/40 bg-white/20 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {u?.photo_url ? <img src={u.photo_url} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-2xl">🙂</span>}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate flex items-center gap-1">
                  {u ? (
                    `${u.first_name ?? ""} ${u?.last_name ?? ""}`.trim() || (u.username ? `@${u.username}` : "Пользователь")
                  ) : (
                    <Skeleton className="h-5 w-40" />
                  )}
                  {u && isVerified && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-sky-300" viewBox="0 0 24 24" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5zm4.03 6.97a.75.75 0 10-1.06-1.06L11 12.09l-1.97-1.97a.75.75 0 10-1.06 1.06l2.5 2.5c.3.3.79.3 1.06 0l4.5-4.5z"
                        clipRule="evenodd"
                      />
                    </svg>
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

        {/* content */}
        <div className="max-w-md mx-auto px-4 -mt-6 space-y-6 pb-28">
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
                <button
                  onClick={async () => u?.id && (await navigator.clipboard.writeText(String(u.id)).catch(()=>{}))}
                  className="mt-2 text-[11px] text-slate-600 underline"
                >
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
            </div>

            {/* Промокод */}
            <div className="mt-4">
              <div className="text-[11px] text-slate-500 mb-1">Промокод</div>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter" && !disabledRedeem) redeem(); }}
                  placeholder="Введите код"
                  className="flex-1 rounded-xl ring-1 ring-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-slate-300"
                />
                <button
                  onClick={redeem}
                  disabled={disabledRedeem}
                  className="rounded-xl bg-slate-900 text-white text-sm px-4 py-2 disabled:opacity-60"
                >
                  Активировать
                </button>
              </div>
              {promoState && (
                <div className={`mt-2 text-xs ${promoState.ok ? "text-emerald-600" : "text-rose-600"}`}>{promoState.msg}</div>
              )}
            </div>
          </div>

          {/* Блок KYC */}
          {!isVerified && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Верификация личности</div>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">не пройдена</span>
              </div>
              <p className="text-sm text-slate-600 mt-2">
                Пройди KYC: фото лица, документа и короткое видео. Камера запросится на отдельной странице.
              </p>
              <Link
                href="/kyc"
                className="inline-block mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Пройти KYC
              </Link>
            </div>
          )}

          {/* Админ переходы (как было) */}
          {role === "admin" && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Админка</div>
                <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
                  role: admin
                </span>
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

          {!u && (
            <div className="text-[12px] text-slate-500 text-center pb-6">
              Запусти мини-приложение из Telegram, чтобы увидеть данные профиля.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
