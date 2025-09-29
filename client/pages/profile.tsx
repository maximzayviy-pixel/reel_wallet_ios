// pages/profile.tsx
// Профиль со "мягким" KYC и выводом ⭐ по СБП.
// ✅ Фикс перекрытия нижнего навбара (большой отступ снизу)
// ✅ Кнопка вывода корректно меняет состояния (disabled/active)
// ✅ Uploadcare ссылки нормализованы к https://ucarecdn.com/<uuid>/
// ✅ Камера: фото лица, фото документа; видео «живости» (webm)

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";
import { createClient } from "@supabase/supabase-js";

// ====== Мини-компоненты камеры прямо в файле (чтобы не создавать новые файлы) ======
function CameraShot({
  label,
  onCapture,
  facingMode = "user",
  width = 360,
  height = 480,
}: {
  label: string;
  onCapture: (dataUrl: string) => void;
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e: any) {
        setErr(e?.message || "Не удалось открыть камеру");
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  const snap = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, width, height);
    const dataUrl = c.toDataURL("image/jpeg", 0.92);
    onCapture(dataUrl);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm">{label}</div>
      <video ref={videoRef} playsInline muted className="rounded-xl w-full bg-black/5" />
      <div className="flex items-center gap-2">
        <button
          onClick={snap}
          disabled={!ready}
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:bg-slate-300"
        >
          Сфотографировать
        </button>
        {err && <div className="text-xs text-rose-600">{err}</div>}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function LivenessRecorder({
  onRecorded,
  maxMs = 5000,
}: {
  onRecorded: (blob: Blob) => void;
  maxMs?: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [count, setCount] = useState<number>(0);
  const chunks = useRef<BlobPart[]>([]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e: any) {
        setErr(e?.message || "Нет доступа к камере");
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (!stream) return;
    chunks.current = [];
    const mr = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
    mr.ondataavailable = (e) => e.data && chunks.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks.current, { type: "video/webm" });
      onRecorded(blob);
    };
    mr.start(250);
    setRec(mr);
    setCount(Math.ceil(maxMs / 1000));
    const timer = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(timer);
          mr.stop();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const stop = () => rec?.state === "recording" && rec.stop();

  return (
    <div className="space-y-2">
      <div className="text-sm">Проверка «живости»: поверни голову влево-вправо</div>
      <video ref={videoRef} playsInline muted className="rounded-xl w-full bg-black/5" />
      <div className="flex items-center gap-2">
        <button
          onClick={start}
          disabled={!!rec && rec.state === "recording"}
          className="px-3 py-2 bg-indigo-600 text-white rounded-lg disabled:bg-slate-300"
        >
          Записать {count ? `(${count})` : ""}
        </button>
        <button
          onClick={stop}
          disabled={!rec || rec.state !== "recording"}
          className="px-3 py-2 bg-slate-200 rounded-lg"
        >
          Стоп
        </button>
        {err && <div className="text-xs text-rose-600">{err}</div>}
      </div>
    </div>
  );
}

// ====== Uploadcare helpers (жёстко нормализуем на ucarecdn.com/<UUID>/) ======
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const type = /data:(.*?);/.exec(header)?.[1] || "image/jpeg";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
async function uploadcarePut(file: Blob, filename = "file.bin"): Promise<string> {
  const pub = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY;
  if (!pub) throw new Error("Uploadcare public key is missing");
  const form = new FormData();
  form.append("UPLOADCARE_PUB_KEY", pub);
  form.append("UPLOADCARE_STORE", "1");
  form.append("file", file, filename);
  const r = await fetch("https://upload.uploadcare.com/base/", { method: "POST", body: form });
  const j = await r.json();
  if (!r.ok || !j?.file) throw new Error(j?.error || "Uploadcare error");
  // ❗️Нормализуем финальную ссылку: всегда ucarecdn.com/<uuid>/
  return `https://ucarecdn.com/${j.file}/`;
}
async function uploadcarePutDataUrl(dataUrl: string): Promise<string> {
  return uploadcarePut(dataUrlToBlob(dataUrl), "image.jpg");
}

// ====== Supabase клиент + Telegram MiniApp ======
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

// Фолбек банки (если /api/sbp-banks недоступен)
type Bank = { name: string; logo: string };
const BANKS_FALLBACK: Bank[] = [
  { name: "Сбербанк", logo: "https://upload.wikimedia.org/wikipedia/commons/1/16/Sberbank_Logo_2020_Russian.svg" },
  { name: "Тинькофф", logo: "https://static.tinkoff.ru/logos/main-logo.svg" },
  { name: "ВТБ", logo: "https://upload.wikimedia.org/wikipedia/commons/1/1d/VTB_logo_ru.svg" },
  { name: "Альфа-Банк", logo: "https://upload.wikimedia.org/wikipedia/commons/6/60/Logo_Alfa-Bank.svg" },
];

export default function Profile() {
  const [u, setU] = useState<TGUser | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [role, setRole] = useState<string>("user");

  // ===== Промокод
  const [code, setCode] = useState("");
  const [promoState, setPromoState] = useState<null | { ok: boolean; msg: string }>(null);
  const disabledRedeem = useMemo(() => !code.trim() || !u?.id, [code, u?.id]);

  // ===== KYC
  const [face, setFace] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [liveBlob, setLiveBlob] = useState<Blob | null>(null);
  const [kycSending, setKycSending] = useState(false);
  const [kycMsg, setKycMsg] = useState<string | null>(null);

  // ===== Вывод
  const [amount, setAmount] = useState<number>(0);
  const [account, setAccount] = useState<string>("");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankQuery, setBankQuery] = useState("");
  const [bank, setBank] = useState<string>("");
  const [wdSending, setWdSending] = useState(false);
  const [wdMsg, setWdMsg] = useState<string | null>(null);

  // ===== Инициализация из Telegram + статусы
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

          // апсерт (на бэке стоит защита от смены роли — см. логи)
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

          // верификация
          fetch("/api/verify-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tg_id: user.id }),
          })
            .then((r) => r.json())
            .then((j) => setIsVerified(!!j?.verified))
            .catch(() => {});

          // роль
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

  // ===== Банки СБП
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/sbp-banks");
        const j = await r.json();
        if (j?.ok && Array.isArray(j.items)) setBanks(j.items as Bank[]);
        else setBanks(BANKS_FALLBACK);
      } catch {
        setBanks(BANKS_FALLBACK);
      }
    })();
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

  const submitKYC = async () => {
    if (!u?.id) return setKycMsg("Не определён Telegram-профиль.");
    if (!face || !doc) return setKycMsg("Сделай фото лица и документа.");
    setKycSending(true);
    setKycMsg(null);
    try {
      const face_url = await uploadcarePutDataUrl(face);
      const doc_url = await uploadcarePutDataUrl(doc);
      let liveness_url: string | undefined;
      if (liveBlob) {
        liveness_url = await uploadcarePut(liveBlob, "liveness.webm");
      }

      const r = await fetch(`/api/kyc-submit?tg_id=${u.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ face_url, doc_url, liveness_url }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Не удалось отправить заявку");
      setKycMsg("Заявка отправлена. Проверим в ближайшее время.");
      setFace(null);
      setDoc(null);
      setLiveBlob(null);
    } catch (e: any) {
      setKycMsg(e?.message || "Ошибка отправки");
    } finally {
      setKycSending(false);
    }
  };

  const canWithdraw = useMemo(() => {
    if (!isVerified) return false;
    if (!u?.id) return false;
    if (!bank || !account.trim()) return false;
    if (!Number.isFinite(amount) || amount <= 0) return false;
    return true;
  }, [isVerified, u?.id, bank, account, amount]);

  const submitWithdraw = async () => {
    if (!canWithdraw) return;
    setWdSending(true);
    setWdMsg(null);
    try {
      const r = await fetch(`/api/withdraw-create?tg_id=${u!.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_stars: amount, bank_code: bank, account }),
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

  const banksFiltered = banks.filter((b) =>
    !bankQuery || b.name.toLowerCase().includes(bankQuery.toLowerCase())
  );

  return (
    <Layout title="Профиль — Reel Wallet">
      <div className="min-h-[100dvh] bg-gradient-to-br from-[#f0f6ff] via-[#e7f0ff] to-[#e6f7ff]">
        {/* Header */}
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

        {/* Content */}
        <div className="max-w-md mx-auto px-4 -mt-6 space-y-6 relative z-0 pb-28">
          {/* Карточка профиля */}
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

          {/* ===== Инлайн KYC (если не верифицирован) ===== */}
          {u && !isVerified && (
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">Верификация личности</div>
                  <p className="text-sm text-slate-600 mt-1">
                    Сделай фото лица, документа и короткое видео с поворотом головы. Файлы попадут в Uploadcare,
                    заявка улетит админу.
                  </p>
                </div>
              </div>

              <CameraShot label="Фото лица" facingMode="user" onCapture={(data) => setFace(data)} />
              {face && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={face} alt="face" className="w-full mt-2 rounded-xl ring-1 ring-slate-200" />
              )}

              <CameraShot label="Фото документа" facingMode="environment" onCapture={(data) => setDoc(data)} />
              {doc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc} alt="doc" className="w-full mt-2 rounded-xl ring-1 ring-slate-200" />
              )}

              <LivenessRecorder onRecorded={(blob) => setLiveBlob(blob)} />
              {liveBlob && (
                <div className="text-xs text-slate-500">
                  Видео записано ({Math.round(liveBlob.size / 1024)} КБ)
                </div>
              )}

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

              <div className="text-xs text-slate-500">Уведомим, когда админ проверит документы.</div>
            </div>
          )}

          {/* ===== Вывод ⭐ по СБП (после верификации) ===== */}
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

                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm text-slate-600">Поиск банка</label>
                  <input
                    className="w-full rounded-xl ring-1 ring-slate-200 px-3 py-2"
                    placeholder="Начни вводить название..."
                    value={bankQuery}
                    onChange={(e) => setBankQuery(e.target.value)}
                  />
                  <div className="grid grid-cols-3 gap-2 max-h-56 overflow-auto pr-1 mt-2">
                    {banksFiltered.map((b) => (
                      <button
                        key={`${b.name}-${b.logo}`}
                        onClick={() => setBank(b.name)}
                        className={`flex flex-col items-center gap-1 rounded-xl ring-1 px-2 py-2 transition
                          ${bank === b.name ? "ring-indigo-400 bg-indigo-50" : "ring-slate-200 bg-white hover:bg-slate-50"}`}
                        title={b.name}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.logo} alt={b.name} className="h-6 w-auto object-contain" />
                        <span className="text-[10px] text-slate-600 text-center line-clamp-2">{b.name}</span>
                      </button>
                    ))}
                    {banksFiltered.length === 0 && (
                      <div className="col-span-3 text-xs text-slate-500">Ничего не найдено</div>
                    )}
                  </div>
                  {bank && <div className="text-xs text-slate-600 mt-1">Выбран: <b>{bank}</b></div>}
                </div>

                <div className="space-y-1 md:col-span-3">
                  <label className="text-sm text-slate-600">Номер телефона для СБП</label>
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
                  disabled={!canWithdraw || wdSending}
                  className={`px-4 py-2 rounded-xl text-white ${
                    !canWithdraw || wdSending ? "bg-slate-300" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  Отправить заявку
                </button>
                {wdMsg && <div className="text-sm text-slate-700">{wdMsg}</div>}
              </div>

              <div className="text-xs text-slate-500">Списание ⭐ произойдёт после подтверждения админом.</div>
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
              {/* Примечание: на бэке у тебя защита "Role change blocked" при апсёрте — это ок, просто игнорим ошибку на фронте. */}
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
