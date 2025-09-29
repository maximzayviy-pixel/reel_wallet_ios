// pages/profile.tsx
// Мягкая интеграция KYC и вывода ⭐, без изменения твоих текущих API.
// Требуется только NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY для Uploadcare.

"use client";

import { useEffect, useMemo, useState } from "react";
import useBanRedirect from "../lib/useBanRedirect";
import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

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

// ✅ список админов через .env (можно: NEXT_PUBLIC_ADMINS=7264453091,12345678)
const ADMINS_ENV = (process.env.NEXT_PUBLIC_ADMINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ===== Uploadcare helpers (как в scan) =====
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const type = /data:(.*?);/.exec(header)?.[1] || "image/jpeg";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
async function uploadToUploadcare(file: Blob | string): Promise<string> {
  const pub = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY;
  if (!pub) throw new Error("Uploadcare public key is missing");
  const form = new FormData();
  form.append("UPLOADCARE_PUB_KEY", pub);
  form.append("UPLOADCARE_STORE", "1");

  let endpoint = "https://upload.uploadcare.com/base/";
  if (typeof file === "string") {
    endpoint = "https://upload.uploadcare.com/base64/";
    const idx = file.indexOf(",");
    form.append("file", idx >= 0 ? file.slice(idx + 1) : file);
  } else {
    form.append("file", file, "kyc.jpg");
  }
  const r = await fetch(endpoint, { method: "POST", body: form });
  const j = await r.json();
  if (!r.ok || !j?.file) throw new Error(j?.error || "Uploadcare error");
  return `https://ucarecdn.com/${j.file}/`;
}

// ===== Справочник банков СБП (можешь подправить) =====
const SBP_BANKS = [
  { code: "sber", name: "Сбербанк" },
  { code: "tcs", name: "Тинькофф" },
  { code: "vtb", name: "ВТБ" },
  { code: "alpha", name: "Альфа-Банк" },
];

export default function Profile() {
  // If the user is banned, redirect to the banned page
  useBanRedirect();

  const [u, setU] = useState<TGUser | null>(null);
  const [status, setStatus] = useState("Открой через Telegram Mini App, чтобы связать профиль.");
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [loadingVerify, setLoadingVerify] = useState(false); // оставлен, но кнопки нет
  const [role, setRole] = useState<string>("user");

  // промокод
  const [code, setCode] = useState("");
  const [promoState, setPromoState] = useState<null | { ok: boolean; msg: string }>(null);
  const disabledRedeem = useMemo(() => !code.trim() || !u?.id, [code, u?.id]);

  // ===== Soft KYC state =====
  const [face, setFace] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [kycSending, setKycSending] = useState(false);
  const [kycMsg, setKycMsg] = useState<string | null>(null);

  // ===== Withdraw state =====
  const [amount, setAmount] = useState<number>(0);
  const [bank, setBank] = useState<string>(SBP_BANKS[0].code);
  const [account, setAccount] = useState<string>("");
  const [wdSending, setWdSending] = useState(false);
  const [wdMsg, setWdMsg] = useState<string | null>(null);

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
          setStatus("Связано с Telegram");

          // ⚡️ мгновенный оверрайд из ENV — чтобы админка открывалась сразу
          const isEnvAdmin = ADMINS_ENV.includes(String(user.id));
          if (isEnvAdmin) setRole("admin");

          // апсерт в БД
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

          // флаг верификации — оставляем ТВОЙ эндпоинт
          fetch("/api/verify-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tg_id: user.id }),
          })
            .then((r) => r.json())
            .then((j) => setIsVerified(!!j?.verified))
            .catch(() => {});

          // роль из БД
          supabase
            .from("users")
            .select("role")
            .eq("tg_id", user.id)
            .maybeSingle()
            .then(({ data, error }) => {
              if (!error) {
                const dbRole = (data as RoleRow)?.role || "user";
                setRole(isEnvAdmin ? "admin" : dbRole);
              } else {
                setRole(isEnvAdmin ? "admin" : "user");
              }
            });

          // realtime по роли
          usersChannel = supabase
            .channel(`users-role-${user.id}`)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "users", filter: `tg_id=eq.${user.id}` },
              (payload: any) => {
                const newRole = payload?.new?.role || payload?.old?.role || "user";
                const isEnvAdminNow = ADMINS_ENV.includes(String(user.id));
                setRole(isEnvAdminNow ? "admin" : newRole);
              }
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

  const copyId = async () => {
    if (!u?.id) return;
    try {
      await navigator.clipboard.writeText(String(u.id));
    } catch {}
  };

  const openSupport = () => {
    const tg = (window as any)?.Telegram?.WebApp;
    const url = "https://t.me/ReelWalet";
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank");
  };

  // buyVerify оставлен, но кнопка скрыта согласно задаче
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
      const link = j.link || j.invoice_link || j.url;
      if (!link) throw new Error("INVOICE_LINK_EMPTY");
      if (tg?.openInvoice) tg.openInvoice(link);
      else if (tg?.openTelegramLink) tg.openTelegramLink(link);
      else window.open(link, "_blank");
    } catch (e: any) {
      alert(e?.message || "Ошибка");
    } finally {
      setLoadingVerify(false);
    }
  };

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

  // ===== Soft KYC handlers =====
  const onPick =
    (setter: (s: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => setter(String(reader.result));
      reader.readAsDataURL(f);
    };

  const submitKYC = async () => {
    if (!u?.id) return setKycMsg("Не определён Telegram-профиль.");
    if (!face || !doc) return setKycMsg("Загрузи фото лица и документа.");
    setKycSending(true);
    setKycMsg(null);
    try {
      const face_url = await uploadToUploadcare(dataUrlToBlob(face));
      const doc_url = await uploadToUploadcare(dataUrlToBlob(doc));
      const r = await fetch(`/api/kyc-submit?tg_id=${u.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ face_url, doc_url }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Не удалось отправить заявку");
      setKycMsg("Заявка отправлена. Проверим в ближайшее время.");
      // Мягко: UI покажет «на проверке», а кнопка вывода появится только после approve на бэке
      setFace(null);
      setDoc(null);
    } catch (e: any) {
      setKycMsg(e?.message || "Ошибка отправки");
    } finally {
      setKycSending(false);
    }
  };

  // ===== Withdraw handler =====
  const submitWithdraw = async () => {
    if (!u?.id) return setWdMsg("Не определён Telegram-профиль.");
    if (!isVerified) return setWdMsg("Доступно после подтверждения KYC.");
    if (amount <= 0) return setWdMsg("Укажи сумму в ⭐.");
    if (!account.trim()) return setWdMsg("Укажи номер телефона для СБП.");

    setWdSending(true);
    setWdMsg(null);
    try {
      const r = await fetch(`/api/withdraw-create?tg_id=${u.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_stars: amount,
          bank_code: bank,
          account,
        }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Не удалось создать заявку");
      setWdMsg("Заявка отправлена. Выплата после подтверждения админом.");
      setAmount(0);
      setAccount("");
    } catch (e: any) {
      setWdMsg(e?.message || "Ошибка заявки");
    } finally {
      setWdSending(false);
    }
  };

  return (
    <Layout title="Профиль — Reel Wallet">
      {/* лёгкий синий фон на всю высоту */}
      <div className="min-h-[100dvh] bg-gradient-to-br from-[#f0f6ff] via-[#e7f0ff] to-[#e6f7ff]">
        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white rounded-b-3xl pb-10 pt-12">
          <div className="max-w-md mx-auto px-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/40 bg-white/20 flex items-center justify-center">
                {u?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.photo_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🙂</span>
                )}
              </div>

              <div className="min-w-0">
                {/* имя + синяя галочка при верификации */}
                <div className="text-lg font-semibold truncate flex items-center gap-1">
                  {u
                    ? `${u.first_name ?? ""} ${u?.last_name ?? ""}`.trim() ||
                      (u.username ? `@${u.username}` : "Пользователь")
                    : <Skeleton className="h-5 w-40" />
                  }

                  {u && isVerified && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 text-sky-500 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-label="Верифицирован"
                    >
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
                onClick={openSupport}
                className="ml-auto text-[11px] bg-white/20 hover:bg-white/30 transition rounded-full px-3 py-1"
              >
                Поддержка
              </button>
            </div>

            <div className="mt-4 text-xs opacity-90">
              {u ? "Связано с Telegram" : status}
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 -mt-6 space-y-6 relative z-10 pb-8">
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

            {/* Промокод */}
            <div className="mt-4">
              <div className="text-[11px] text-slate-500 mb-1">Промокод</div>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !disabledRedeem) redeem();
                  }}
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
                <div className={`mt-2 text-xs ${promoState.ok ? "text-emerald-600" : "text-rose-600"}`}>
                  {promoState.msg}
                </div>
              )}
            </div>
          </div>

          {/* ===== Инлайн KYC (видно, если не верифицирован) ===== */}
          {u && !isVerified && (
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">Верификация личности</div>
                  <p className="text-sm text-slate-600 mt-1">
                    Мягкая проверка: загрузи фото лица и документа (паспорт/ID). Файлы попадут в Uploadcare,
                    заявка улетит админу.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <div className="text-sm mb-1">Фото лица</div>
                  <input type="file" accept="image/*" onChange={(e) => onPick(setFace)(e)} />
                  {face && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={face} alt="face" className="w-full mt-2 rounded-xl ring-1 ring-slate-200" />
                  )}
                </label>

                <label className="block">
                  <div className="text-sm mb-1">Фото документа</div>
                  <input type="file" accept="image/*" onChange={(e) => onPick(setDoc)(e)} />
                  {doc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={doc} alt="doc" className="w-full mt-2 rounded-xl ring-1 ring-slate-200" />
                  )}
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={submitKYC}
                  disabled={kycSending || !face || !doc}
                  className={`px-4 py-2 rounded-xl text-white ${
                    kycSending || !face || !doc ? "bg-slate-300" : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  Отправить на проверку
                </button>
                {kycMsg && <div className="text-sm text-slate-700">{kycMsg}</div>}
              </div>

              <div className="text-xs text-slate-500">Мы сообщим, как только админ проверит документы.</div>
            </div>
          )}

          {/* ===== Вывод ⭐ по СБП (видно, если верифицирован) ===== */}
          {u && isVerified && (
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">Вывод ⭐ по СБП</div>
                  <p className="text-sm text-slate-600 mt-1">
                    Укажи сумму, выбери банк и номер телефона для СБП. Заявка отправится админу.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-slate-600">Сумма (⭐)</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-xl ring-1 ring-slate-200 px-3 py-2"
                    value={amount || ""}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm text-slate-600">Банк СБП</label>
                  <select
                    className="w-full rounded-xl ring-1 ring-slate-200 px-3 py-2"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                  >
                    {SBP_BANKS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm text-slate-600">Номер телефона</label>
                  <input
                    type="tel"
                    placeholder="+7XXXXXXXXXX"
                    className="w-full rounded-xl ring-1 ring-slate-200 px-3 py-2"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={submitWithdraw}
                  disabled={wdSending}
                  className={`px-4 py-2 rounded-xl text-white ${
                    wdSending ? "bg-slate-300" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  Отправить заявку
                </button>
                {wdMsg && <div className="text-sm text-slate-700">{wdMsg}</div>}
              </div>

              <div className="text-xs text-slate-500">Списание ⭐ произойдёт после подтверждения админом.</div>
            </div>
          )}

          {/* Админ-блок */}
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
