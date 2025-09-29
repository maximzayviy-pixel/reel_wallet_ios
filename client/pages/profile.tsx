// app/profile/page.tsx  (или pages/profile.tsx)
// Профиль с мягкой KYC и выводом ⭐. Tailwind UI.
// Требуемые ENV: NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY

"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ---------- Helpers ----------
function clsx(...a: Array<string | false | undefined>) {
  return a.filter(Boolean).join(" ");
}
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

// ---------- Types ----------
type UserInfo = {
  tg_id: number;
  username?: string | null;
  stars?: number;
  is_verified?: boolean;
  kyc_status?: "none" | "pending" | "approved" | "rejected";
};

// Для демо-списка банков СБП — подправь под свои
const SBP_BANKS = [
  { code: "sber", name: "Сбербанк" },
  { code: "tcs", name: "Тинькофф" },
  { code: "vtb", name: "ВТБ" },
  { code: "alpha", name: "Альфа-Банк" },
];

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // --- soft KYC local state ---
  const [face, setFace] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [kycSending, setKycSending] = useState(false);
  const [kycMsg, setKycMsg] = useState<string | null>(null);

  // --- withdraw local state ---
  const [amount, setAmount] = useState<number>(0);
  const [bank, setBank] = useState<string>(SBP_BANKS[0].code);
  const [account, setAccount] = useState<string>(""); // телефон СБП
  const [wdSending, setWdSending] = useState(false);
  const [wdMsg, setWdMsg] = useState<string | null>(null);

  // Получаем tg_id из твоей мини-аппы, если ты уже кладёшь его глобально
  const tgIdFromWindow = useMemo<number | null>(() => {
    const v =
      (typeof window !== "undefined" &&
        (window as any).__TG_INIT_DATA_USER__?.id) ||
      null;
    return v ? Number(v) : null;
  }, []);

  // Подтягиваем user-info
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        // Если tg_id не прокинут через window, бек может достать его из сессии/токена
        const url = tgIdFromWindow
          ? `/api/user-info?tg_id=${tgIdFromWindow}`
          : `/api/user-info`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`user-info: ${r.status}`);
        const j = await r.json();
        if (!cancelled) setUser(j as UserInfo);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Не удалось загрузить профиль");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tgIdFromWindow]);

  // ---------- Handlers ----------
  const selectFile =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => setter(String(reader.result));
      reader.readAsDataURL(f);
    };

  const submitKYC = async () => {
    if (!face || !doc) {
      setKycMsg("Загрузи фото лица и документа.");
      return;
    }
    setKycSending(true);
    setKycMsg(null);
    try {
      const face_url = await uploadToUploadcare(dataUrlToBlob(face));
      const doc_url = await uploadToUploadcare(dataUrlToBlob(doc));
      const r = await fetch("/api/kyc-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ face_url, doc_url }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Не удалось отправить заявку");
      setKycMsg("Заявка на верификацию отправлена. Обычно это недолго.");
      // мягко переключаем статус на pending, чтобы сразу показать пользователю
      setUser((u) => (u ? { ...u, kyc_status: "pending" } : u));
      setFace(null);
      setDoc(null);
    } catch (e: any) {
      setKycMsg(e?.message || "Ошибка отправки");
    } finally {
      setKycSending(false);
    }
  };

  const submitWithdraw = async () => {
    setWdMsg(null);
    if (!user?.is_verified) {
      setWdMsg("Доступно после подтверждения KYC.");
      return;
    }
    if (amount <= 0) return setWdMsg("Укажи сумму в ⭐.");
    if (!account.trim()) return setWdMsg("Укажи номер телефона для СБП.");

    // простая клиентская проверка баланса (на бэке всё равно проверяется)
    if ((user.stars ?? 0) < amount) return setWdMsg("Недостаточно ⭐.");

    setWdSending(true);
    try {
      const r = await fetch("/api/withdraw-create", {
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
      setWdMsg("Заявка на вывод отправлена. Мы уведомим, когда будет выплата.");
      // Можно оптимистично уменьшить баланс визуально (списание фактически при approve)
      setUser((u) =>
        u ? { ...u, stars: Number(u.stars || 0) - Number(amount) } : u
      );
      setAmount(0);
      setAccount("");
    } catch (e: any) {
      setWdMsg(e?.message || "Ошибка заявки");
    } finally {
      setWdSending(false);
    }
  };

  // ---------- UI ----------
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-4 animate-pulse">
        <div className="h-8 w-40 bg-slate-200 rounded mb-4" />
        <div className="h-24 w-full bg-slate-200 rounded mb-4" />
        <div className="h-48 w-full bg-slate-200 rounded" />
      </div>
    );
  }
  if (err) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="rounded-xl bg-red-50 text-red-700 p-4">
          Ошибка: {err}
        </div>
      </div>
    );
  }
  const verified = !!user?.is_verified;
  const kycStatus = user?.kyc_status || (verified ? "approved" : "none");

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Профиль</h1>
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-4"
        >
          На главную
        </Link>
      </div>

      {/* Summary Card */}
      <div className="rounded-2xl border border-slate-200 p-4 md:p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-slate-500 text-sm">Пользователь</div>
            <div className="font-medium">
              @{user?.username || user?.tg_id || "unknown"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-slate-500 text-sm">Баланс</div>
            <div className="text-2xl font-semibold">{user?.stars ?? 0} ⭐</div>
          </div>
        </div>

        {/* KYC status chip */}
        <div className="mt-4 flex items-center gap-2">
          <span
            className={clsx(
              "px-2.5 py-1 rounded-full text-xs font-medium",
              kycStatus === "approved" && "bg-emerald-50 text-emerald-700",
              kycStatus === "pending" && "bg-amber-50 text-amber-700",
              (kycStatus === "none" || kycStatus === "rejected") &&
                "bg-slate-100 text-slate-700"
            )}
          >
            {kycStatus === "approved"
              ? "KYC подтверждён"
              : kycStatus === "pending"
              ? "KYC на проверке"
              : kycStatus === "rejected"
              ? "KYC отклонён"
              : "KYC не пройден"}
          </span>

          {!verified && (
            <span className="text-xs text-slate-500">
              Пройди KYC, чтобы вывести ⭐
            </span>
          )}
        </div>
      </div>

      {/* Soft KYC Block (inline) */}
      {!verified && (
        <div className="rounded-2xl border border-slate-200 p-4 md:p-6 bg-white shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Верификация личности</h2>
              <p className="text-sm text-slate-600 mt-1">
                Мягкая проверка: загрузи фото лица и документа (паспорт/ID).
                Файлы попадут в Uploadcare, заявка улетит админу.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <div className="text-sm mb-1">Фото лица</div>
              <input type="file" accept="image/*" onChange={selectFile(setFace)} />
              {face && (
                <img
                  src={face}
                  alt="face"
                  className="w-full mt-2 rounded-xl ring-1 ring-slate-200"
                />
              )}
            </label>

            <label className="block">
              <div className="text-sm mb-1">Фото документа</div>
              <input type="file" accept="image/*" onChange={selectFile(setDoc)} />
              {doc && (
                <img
                  src={doc}
                  alt="doc"
                  className="w-full mt-2 rounded-xl ring-1 ring-slate-200"
                />
              )}
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={submitKYC}
              disabled={kycSending || !face || !doc}
              className={clsx(
                "px-4 py-2 rounded-xl text-white",
                kycSending || !face || !doc
                  ? "bg-slate-300"
                  : "bg-indigo-600 hover:bg-indigo-700"
              )}
            >
              Отправить на проверку
            </button>
            {kycMsg && <div className="text-sm text-slate-700">{kycMsg}</div>}
          </div>

          {/* Подсказка по статусу «pending» */}
          {kycStatus === "pending" && (
            <div className="text-xs text-slate-500">
              Мы сообщим, как только админ проверит документы.
            </div>
          )}
        </div>
      )}

      {/* Withdraw (visible when verified) */}
      {verified && (
        <div className="rounded-2xl border border-slate-200 p-4 md:p-6 bg-white shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Вывод ⭐ по СБП</h2>
              <p className="text-sm text-slate-600 mt-1">
                Заполни сумму, выбери банк и укажи номер телефона для СБП.
                Заявка улетит админу — после подтверждения средства придут на счёт.
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
              <label className="text-sm text-slate-600">Номер для СБП</label>
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
              className={clsx(
                "px-4 py-2 rounded-xl text-white",
                wdSending ? "bg-slate-300" : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              Отправить заявку
            </button>
            {wdMsg && <div className="text-sm text-slate-700">{wdMsg}</div>}
          </div>

          <div className="text-xs text-slate-500">
            Списание ⭐ происходит после подтверждения заявки админом.
          </div>
        </div>
      )}

      {/* Help / debug */}
      <div className="text-xs text-slate-400">
        Если статус не обновился — проверь, что бек эндпоинты настроены:
        <code className="ml-1">/api/user-info</code>,{" "}
        <code>/api/kyc-submit</code>, <code>/api/withdraw-create</code> и
        переменные окружения Uploadcare.
      </div>
    </div>
  );
}
