"use client";
import Layout from "../components/Layout";
import useBanRedirect from "../lib/useBanRedirect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { parseEMVQR, parseSBPLink } from "../lib/emv";

// Uploadcare
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const contentType = /data:(.*?);/.exec(header)?.[1] || "image/jpeg";
  const byteChars = atob(base64);
  const arr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) arr[i] = byteChars.charCodeAt(i);
  return new Blob([arr], { type: contentType });
}
async function uploadToUploadcare(blobOrDataUrl: Blob | string): Promise<string> {
  const pub = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY;
  if (!pub) throw new Error("Uploadcare public key is missing (NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY)");
  let endpoint = "https://upload.uploadcare.com/base/";
  const form = new FormData();
  form.append("UPLOADCARE_PUB_KEY", pub);
  form.append("UPLOADCARE_STORE", "1");
  if (typeof blobOrDataUrl === "string") {
    endpoint = "https://upload.uploadcare.com/base64/";
    const idx = blobOrDataUrl.indexOf(",");
    const payload = idx >= 0 ? blobOrDataUrl.slice(idx + 1) : blobOrDataUrl;
    form.append("file", payload);
  } else {
    form.append("file", blobOrDataUrl, "qr.jpg");
  }
  const res = await fetch(endpoint, { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok || !json?.file) throw new Error("Uploadcare error");
  return `https://ucarecdn.com/${json.file}/`;
}

function Dots() {
  return (
    <span className="inline-flex w-8 justify-between align-middle">
      <span className="animate-bounce [animation-delay:-0.3s]">•</span>
      <span className="animate-bounce [animation-delay:-0.15s]">•</span>
      <span className="animate-bounce">•</span>
    </span>
  );
}

type ScanData = {
  raw: string;
  merchant?: string;
  pan?: string;
  city?: string;
  amountRub: number;
};

export default function Scan() {
  useBanRedirect();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [data, setData] = useState<ScanData | null>(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // torch
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // fallback UI
  const [showUnrecognizedModal, setShowUnrecognizedModal] = useState(false);
  const [manualAmount, setManualAmount] = useState<string>("");
  const [fallbackUploading, setFallbackUploading] = useState(false);

  // start camera + ZXing
  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!videoRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (disposed) return;
        mediaStreamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() || {}) as MediaTrackCapabilities & { torch?: boolean };
        if (typeof caps.torch === "boolean") setTorchSupported(caps.torch);
        if (videoRef.current) videoRef.current.srcObject = stream;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (res, err, controls) => {
            if (disposed) return;
            if (res?.getText()) {
              controls.stop();
              controlsRef.current = controls;
              const raw = res.getText();

              let rub: number | null = null;
              let merchant = "", pan = "", city = "";

              const sbp = parseSBPLink(raw);
              if (sbp?.amount) rub = sbp.amount;

              const emv = parseEMVQR(raw);
              if (emv) {
                merchant = emv.merchant || merchant;
                city = emv.city || city;
                pan = emv.account || emv?.nodes?.["26"]?.["01"] || "";
                if (rub === null && typeof emv.amount === "number") rub = emv.amount;
              }

              if (!rub || rub <= 0) {
                setShowUnrecognizedModal(true); // предлагаем ручной ввод
              } else {
                setData({ raw, merchant, pan, city, amountRub: rub });
              }
            }
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        console.error(e);
        setStatus("Не удалось получить доступ к камере.");
      }
    })();
    return () => {
      try { controlsRef.current?.stop(); } catch {}
      try { mediaStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    };
  }, []);

  // torch
  const applyTorch = useCallback(async (on: boolean) => {
    try {
      const stream = mediaStreamRef.current || (videoRef.current?.srcObject as MediaStream);
      const track = stream?.getVideoTracks?.()[0];
      if (!track) return false;
      const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      if (!caps || !("torch" in caps)) return false;
      await track.applyConstraints({ advanced: [{ torch: on }] as any });
      setTorchOn(on);
      return true;
    } catch {
      return false;
    }
  }, []);
  const toggleTorch = useCallback(async () => {
    const ok = await applyTorch(!torchOn);
    if (!ok) setStatus("Вспышка не поддерживается на этом устройстве.");
    else {
      try {(window as any)?.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");} catch {}
    }
  }, [applyTorch, torchOn]);

  // snapshot
  const takeSnapshot = useCallback((): string | null => {
    const v = videoRef.current; if (!v) return null;
    const c = document.createElement("canvas");
    const w = v.videoWidth || 720, h = v.videoHeight || 1280;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d"); if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    try { return c.toDataURL("image/jpeg", 0.92); } catch { return c.toDataURL("image/png"); }
  }, []);

  const closeModal = () => {
    setData(null);
    setError(null);
    setStatus(null);
    setShowUnrecognizedModal(false);
  };

  // обычный флоу (распознано)
  async function pay() {
    if (!data) return;
    const uidRaw = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
    const tg_id = uidRaw ? Number(uidRaw) : null;
    if (!tg_id) { setStatus("Не найден tg_id (открой через Telegram WebApp)."); return; }

    setSending(true);
    setStatus(null);
    try {
      const qr_image_b64 = takeSnapshot();
      const payload: any = { tg_id, qr_payload: data.raw, amount_rub: data.amountRub, qr_image_b64 };
      const res = await fetch("/api/scan-submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        if (json?.reason === "INSUFFICIENT_BALANCE") setStatus(`Недостаточно ⭐: нужно ${json.need}, у вас только ${json.have}.`);
        else if (json?.reason === "NO_USER") setStatus("Не найден профиль. Перезапусти бота в Telegram.");
        else setStatus(`Ошибка: ${json?.reason || json?.error || "неизвестная"}`);
        return;
      }
      setStatus("⏳ Ожидаем оплату");
      setData(null);
    } catch (e: any) {
      setStatus(`Ошибка: ${e?.message || String(e)}`);
    } finally {
      setSending(false);
    }
  }

  // фоллбек: QR не распознан — ввод суммы → фото → Uploadcare → force_notify
  const sendUnrecognized = useCallback(async () => {
    const uidRaw = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
    const tg_id = uidRaw ? Number(uidRaw) : null;
    if (!tg_id) { setStatus("Не найден tg_id (открой через Telegram WebApp)."); return; }

    const amount = Number((manualAmount || "").replace(",", "."));
    if (!amount || amount <= 0) { setError("Укажи корректную сумму в ₽"); return; }

    try {
      setFallbackUploading(true);
      setStatus(null);

      const snap = takeSnapshot();
      if (!snap) throw new Error("Не удалось сделать фото QR");
      const cdnUrl = await uploadToUploadcare(dataUrlToBlob(snap));

      const resp = await fetch("/api/scan-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tg_id,
          qr_payload: "FALLBACK_NO_QR",
          amount_rub: amount,
          qr_image_b64: cdnUrl,
          force_notify: true, // уведомляем админа даже при недостатке ⭐
        }),
      });
      const json = await resp.json();

      if (!resp.ok || !json?.ok) {
        setStatus(`Ошибка отправки: ${json?.reason || json?.error || "неизвестная"}`);
        return;
      }

      setShowUnrecognizedModal(false);
      setStatus("⏳ Ожидаем оплату");
    } catch (e: any) {
      console.error(e);
      setStatus(`Ошибка резервной отправки: ${e?.message || String(e)}`);
    } finally {
      setFallbackUploading(false);
    }
  }, [manualAmount, takeSnapshot]);

  const stars = useMemo(
    () => (data ? Math.round(data.amountRub * 2) : Math.round(Number((manualAmount || "0").replace(",", ".")) * 2)),
    [data, manualAmount]
  );

  return (
    <Layout>
      {/* LIGHT THEME */}
      <div className="relative min-h-[100dvh] bg-gradient-to-br from-white via-gray-50 to-gray-100 text-slate-900">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60rem_60rem_at_20%_20%,rgba(59,130,246,0.08),transparent_60%),radial-gradient(40rem_40rem_at_80%_0%,rgba(16,185,129,0.08),transparent_60%),radial-gradient(50rem_50rem_at_90%_80%,rgba(168,85,247,0.08),transparent_60%)]" />

        {/* top bar */}
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={() => {
              try {
                const tg: any = (window as any).Telegram?.WebApp;
                if (tg?.close) tg.close();
                else window.history.back();
              } catch {
                window.history.back();
              }
            }}
            className="text-sm text-slate-700 hover:text-slate-900"
          >
            Отмена
          </button>
        </div>
        <div className="absolute top-16 left-0 right-0 z-20 flex flex-col items-center">
          <div className="text-sm text-slate-600 mt-1">Наведите на QR-код для оплаты</div>
        </div>

        {/* header */}
        <div className="relative px-4 pt-[5.5rem] pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-slate-900/5 ring-1 ring-slate-900/10 backdrop-blur-sm grid place-items-center">🔎</div>
            <div className="text-lg font-semibold tracking-tight">Сканер QR</div>
          </div>
          <div className="text-xs text-slate-600">2⭐ = 1₽</div>
        </div>

        {/* scanner card */}
        <div className="relative px-4">
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-slate-200 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)] bg-white">
            <video
              ref={videoRef}
              className="w-full aspect-[3/4] bg-black/70 object-cover rounded-3xl"
              playsInline
              muted
              autoPlay
            />
            {/* HUD */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-[72%] aspect-square rounded-3xl border-[3px] border-slate-900/20 shadow-[0_0_30px_rgba(0,0,0,0.08)]" />
            </div>
            {/* Bottom fade */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-white to-transparent" />
            {/* status pill */}
            {!data && !error && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs bg-white ring-1 ring-slate-200 text-slate-600 backdrop-blur-md">
                Сканирование<Dots />
              </div>
            )}
          </div>

          {/* torch + unrecognized */}
          <div className="flex justify-center gap-3 mt-3">
            <button
              onClick={toggleTorch}
              className={`w-12 h-12 rounded-full backdrop-blur-sm text-slate-900 text-xl flex items-center justify-center ring-1 ring-slate-300 ${
                torchOn ? "bg-amber-300" : "bg-white"
              }`}
              aria-pressed={torchOn}
              title={torchSupported ? "Вспышка" : "Вспышка недоступна"}
              disabled={!torchSupported}
            >
              🔦
            </button>
            <button
              onClick={() => setShowUnrecognizedModal(true)}
              className="px-4 h-12 rounded-2xl bg-white ring-1 ring-slate-300 text-slate-900 text-sm"
            >
              QR не распознан
            </button>
          </div>
        </div>

        {/* LOADER OVERLAY: GIF по центру */}
        {status && (
          <div className="fixed inset-0 z-40 grid place-items-center p-4 bg-white/70 backdrop-blur-sm">
            <img
              src="https://i.imgur.com/Z6oUpJQ.gif"
              alt="Загрузка…"
              className="w-64 h-auto rounded-xl shadow-xl ring-1 ring-slate-200"
            />
          </div>
        )}

        {/* confirm (normal flow) */}
        {data && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm" />
            <div className="absolute inset-0 [background:radial-gradient(35rem_35rem_at_50%_0%,rgba(59,130,246,0.12),transparent_60%),radial-gradient(30rem_30rem_at_20%_80%,rgba(99,102,241,0.12),transparent_60%)]" />
            <div className="relative w-full max-w-md rounded-3xl overflow-hidden ring-1 ring-slate-200 shadow-2xl">
              <div className="bg-white">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-base font-semibold">Подтверждение оплаты</div>
                  <button onClick={closeModal} className="text-slate-600 hover:text-slate-800 transition-colors" aria-label="Закрыть">✕</button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="rounded-2xl p-3 bg-white ring-1 ring-slate-200">
                    <div className="text-xs text-slate-500">Получатель</div>
                    <div className="font-medium truncate">{data.merchant || "Неизвестно"}</div>
                    {data.city ? (<div className="text-xs text-slate-500 mt-0.5">Город: {data.city}</div>) : null}
                    {data.pan ? (<div className="text-xs text-slate-500 mt-0.5">PAN: <span className="font-mono">{data.pan}</span></div>) : null}
                  </div>
                  <div className="rounded-2xl p-3 bg-white ring-1 ring-slate-200 flex items-center justify-between">
                    <div className="text-slate-700">Сумма</div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{data.amountRub.toLocaleString("ru-RU")} ₽</div>
                      <div className="text-xs text-slate-500">{stars} ⭐</div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button onClick={closeModal} className="px-4 py-2 rounded-xl ring-1 ring-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors">Отказаться</button>
                    <button onClick={pay} disabled={sending} className="px-5 py-2 rounded-xl text-white disabled:opacity-60 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow">{sending ? "Отправка..." : "Оплатить"}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QR не распознан → ввод суммы */}
        {showUnrecognizedModal && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm" />
            <div className="relative w-full max-w-md rounded-3xl overflow-hidden ring-1 ring-slate-200 shadow-2xl bg-white text-slate-900">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="text-base font-semibold">QR не распознан</div>
                <button onClick={() => setShowUnrecognizedModal(false)} className="text-slate-600 hover:text-slate-800" aria-label="Закрыть">✕</button>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-sm text-slate-700">Укажи сумму оплаты, мы сделаем фото, отправим администратору и дождёмся подтверждения.</div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      inputMode="decimal"
                      placeholder="Сумма, ₽"
                      className="w-full rounded-xl px-3 py-2 ring-1 ring-slate-300 focus:ring-slate-400 outline-none bg-white"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                      {manualAmount ? `${Math.max(0, Math.round(Number((manualAmount||"0").replace(",", "."))*2))} ⭐` : ""}
                    </div>
                  </div>
                  <button
                    onClick={sendUnrecognized}
                    disabled={fallbackUploading}
                    className="px-4 py-2 rounded-xl text-white disabled:opacity-60 bg-gradient-to-r from-indigo-600 to-blue-600"
                  >
                    {fallbackUploading ? "Отправка…" : "QR не распознан"}
                  </button>
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
              </div>
            </div>
          </div>
        )}

        {/* error modal (остаётся светлой) */}
        {error && !showUnrecognizedModal && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm" />
            <div className="relative w-full max-w-md rounded-3xl overflow-hidden ring-1 ring-slate-200 shadow-2xl">
              <div className="bg-white text-slate-900">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-base font-semibold">Не удалось распознать сумму</div>
                  <button onClick={closeModal} className="text-slate-600 hover:text-slate-800" aria-label="Закрыть">✕</button>
                </div>
                <div className="p-4 text-sm text-slate-700">QR-код не содержит сумму или формат отличается от СБП/EMV.</div>
                <div className="p-4 pt-0 flex justify-end">
                  <button
                    onClick={() => { setError(null); setShowUnrecognizedModal(true); }}
                    className="px-4 py-2 rounded-xl ring-1 ring-slate-300 text-slate-700 bg-white hover:bg-slate-50"
                  >
                    Ввести сумму вручную
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
