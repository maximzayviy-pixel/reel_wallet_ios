"use client";
import Layout from "../components/Layout";
import useBanRedirect from "../lib/useBanRedirect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { parseEMVQR, parseSBPLink } from "../lib/emv";

type ScanData = {
  raw: string;
  merchant?: string;
  pan?: string;
  city?: string;
  amountRub: number;
};

// ========== Uploadcare helpers ==========
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const contentType = /data:(.*?);/.exec(header)?.[1] || "image/jpeg";
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

async function uploadToUploadcare(file: Blob | string): Promise<string> {
  const pub = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY;
  if (!pub) throw new Error("Uploadcare public key is missing (NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY)");

  const form = new FormData();
  form.append("UPLOADCARE_PUB_KEY", pub);
  form.append("UPLOADCARE_STORE", "1");

  let endpoint = "https://upload.uploadcare.com/base/";
  if (typeof file === "string") {
    endpoint = "https://upload.uploadcare.com/base64/";
    const idx = file.indexOf(",");
    const payload = idx >= 0 ? file.slice(idx + 1) : file;
    form.append("file", payload);
  } else {
    form.append("file", file, "qr.jpg");
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

// ========== Component ==========
export default function Scan() {
  // Redirect banned users
  useBanRedirect();

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [data, setData] = useState<ScanData | null>(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Torch
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Fallback (10s) + manual amount
  const [showUnrecognizedModal, setShowUnrecognizedModal] = useState(false);
  const [manualAmount, setManualAmount] = useState<string>("");
  const [fallbackUploading, setFallbackUploading] = useState(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Когда показываем GIF вместо камеры
  const waiting = !!status && status.includes("Ожидаем оплату");

  // ========== Start camera + ZXing ==========
  useEffect(() => {
    let disposed = false;
    let cameraInitialized = false;

    (async () => {
      if (!videoRef.current) return;
      
      // Проверяем поддержку камеры
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("Камера не поддерживается в этом браузере.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 1920 },
          },
          audio: false,
        });
        if (disposed) return;

        cameraInitialized = true;
        mediaStreamRef.current = stream;

        // Detect torch support
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() || {}) as MediaTrackCapabilities & { torch?: boolean };
        if (typeof caps.torch === "boolean") setTorchSupported(caps.torch);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Ждем загрузки видео
          await new Promise((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = resolve;
            }
          });
        }

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

              clearFallback();
              if (!rub || rub <= 0) {
                // Нет суммы → просим вручную
                setShowUnrecognizedModal(true);
              } else {
                setData({ raw, merchant, pan, city, amountRub: rub });
              }
            }
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        console.error("Camera error:", e);
        if (e instanceof Error) {
          if (e.name === "NotAllowedError") {
            setStatus("Доступ к камере запрещен. Разрешите доступ в настройках браузера.");
          } else if (e.name === "NotFoundError") {
            setStatus("Камера не найдена. Убедитесь, что устройство имеет камеру.");
          } else if (e.name === "NotSupportedError") {
            setStatus("Камера не поддерживается в этом браузере.");
          } else {
            setStatus(`Ошибка камеры: ${e.message}`);
          }
        } else {
          setStatus("Не удалось получить доступ к камере.");
        }
      }
    })();

    return () => {
      disposed = true;
      try {
        controlsRef.current?.stop();
        controlsRef.current = null;
      } catch {}
      try {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      } catch {}
      clearFallback();
      setTorchOn(false);
    };
  }, []);

  // ========== 10s fallback timer ==========
  const startFallbackCountdown = () => {
    clearFallback();
    fallbackTimer.current = setTimeout(() => {
      // Если за 10 сек не распознали — предложить ручной ввод
      setShowUnrecognizedModal(true);
    }, 10_000);
  };
  const clearFallback = () => {
    if (fallbackTimer.current) {
      clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
  };

  // Следим за состояниями, и включаем/выключаем таймер
  useEffect(() => {
    // Запускаем таймер только если камера инициализирована и нет других активных состояний
    if (!waiting && !showUnrecognizedModal && !data && !status) {
      startFallbackCountdown();
    } else {
      clearFallback();
    }
    return () => clearFallback();
  }, [waiting, showUnrecognizedModal, data, status]);

  // ========== Torch controls ==========
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
    } catch (e) {
      console.warn("Torch apply failed", e);
      return false;
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    const ok = await applyTorch(!torchOn);
    if (!ok) setStatus("Вспышка не поддерживается на этом устройстве.");
    else {
      try {
        (window as any)?.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
      } catch {}
    }
  }, [applyTorch, torchOn]);

  // ========== Snapshot ==========
  const takeSnapshot = useCallback((): string | null => {
    const v = videoRef.current;
    if (!v) return null;
    const c = document.createElement("canvas");
    const w = v.videoWidth || 720,
      h = v.videoHeight || 1280;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    try {
      return c.toDataURL("image/jpeg", 0.92);
    } catch {
      return c.toDataURL("image/png");
    }
  }, []);

  // ========== Close any modal ==========
  const closeModal = () => {
    setData(null);
    setError(null);
    setStatus(null);
    setShowUnrecognizedModal(false);
  };

  // ========== Normal pay flow (recognized) ==========
  async function pay() {
    if (!data) return;
    const uidRaw = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
    const tg_id = uidRaw ? Number(uidRaw) : null;
    if (!tg_id) {
      setStatus("Не найден tg_id (открой через Telegram WebApp).");
      return;
    }

    setSending(true);
    setStatus(null);
    setError(null);
    
    try {
      const qr_image_b64 = takeSnapshot();
      if (!qr_image_b64) {
        setStatus("Не удалось сделать снимок QR-кода. Попробуйте еще раз.");
        return;
      }

      const payload: any = {
        tg_id,
        qr_payload: data.raw,
        amount_rub: data.amountRub,
        qr_image_b64,
      };

      const res = await fetch("/api/scan-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      let json;
      try {
        json = await res.json();
      } catch (parseError) {
        setStatus("Ошибка обработки ответа сервера. Попробуйте еще раз.");
        return;
      }

      if (!res.ok || !json?.ok) {
        if (json?.reason === "INSUFFICIENT_BALANCE") {
          setStatus(`Недостаточно ⭐: нужно ${json.need}, у вас только ${json.have}.`);
        } else if (json?.reason === "NO_USER") {
          setStatus("Не найден профиль. Перезапусти бота в Telegram.");
        } else if (json?.reason === "METHOD_NOT_ALLOWED") {
          setStatus("Ошибка сервера. Попробуйте позже.");
        } else {
          setStatus(`Ошибка: ${json?.reason || json?.error || "неизвестная"}`);
        }
        return;
      }

      // Включаем режим ожидания → GIF подменит камеру
      setStatus("⏳ Ожидаем оплату");
      setData(null);
    } catch (e: any) {
      console.error("Pay error:", e);
      if (e.name === "TypeError" && e.message.includes("fetch")) {
        setStatus("Ошибка сети. Проверьте подключение к интернету.");
      } else {
        setStatus(`Ошибка: ${e?.message || String(e)}`);
      }
    } finally {
      setSending(false);
    }
  }

  // ========== Fallback flow: manual amount + send to admin ==========
  const sendUnrecognized = useCallback(async () => {
    const uidRaw = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
    const tg_id = uidRaw ? Number(uidRaw) : null;
    if (!tg_id) {
      setStatus("Не найден tg_id (открой через Telegram WebApp).");
      return;
    }

    const amount = Number((manualAmount || "").replace(",", "."));
    if (!amount || amount <= 0 || amount > 100000) {
      setError("Укажи корректную сумму в ₽ (от 1 до 100,000)");
      return;
    }

    try {
      setFallbackUploading(true);
      setStatus(null);
      setError(null);

      // Делаем снимок и грузим в Uploadcare → получаем CDN URL (для sendPhoto)
      const snap = takeSnapshot();
      if (!snap) {
        setError("Не удалось сделать фото QR. Попробуйте еще раз.");
        return;
      }

      let cdnUrl: string;
      try {
        cdnUrl = await uploadToUploadcare(dataUrlToBlob(snap));
      } catch (uploadError) {
        console.error("Upload error:", uploadError);
        setError("Ошибка загрузки фото. Попробуйте еще раз.");
        return;
      }

      const resp = await fetch("/api/scan-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tg_id,
          qr_payload: "FALLBACK_NO_QR",
          amount_rub: amount,
          qr_image_b64: cdnUrl, // http(s) URL → бэк отошлёт как фото админу
          force_notify: true,   // важно: шлём админу даже при нехватке ⭐
        }),
      });
      
      let json;
      try {
        json = await resp.json();
      } catch (parseError) {
        setStatus("Ошибка обработки ответа сервера. Попробуйте еще раз.");
        return;
      }

      if (!resp.ok || !json?.ok) {
        if (json?.reason === "INSUFFICIENT_BALANCE") {
          setStatus(`Недостаточно ⭐: нужно ${json.need}, у вас только ${json.have}. Запрос отправлен админу.`);
        } else {
          setStatus(`Ошибка отправки: ${json?.reason || json?.error || "неизвестная"}`);
        }
        return;
      }

      // Включаем режим ожидания → GIF подменит камеру
      setShowUnrecognizedModal(false);
      setStatus("⏳ Ожидаем оплату");
    } catch (e: any) {
      console.error("SendUnrecognized error:", e);
      if (e.name === "TypeError" && e.message.includes("fetch")) {
        setStatus("Ошибка сети. Проверьте подключение к интернету.");
      } else {
        setStatus(`Ошибка резервной отправки: ${e?.message || String(e)}`);
      }
    } finally {
      setFallbackUploading(false);
    }
  }, [manualAmount, takeSnapshot]);

  const stars = useMemo(
    () =>
      data
        ? Math.round(data.amountRub * 2)
        : Math.round(Number((manualAmount || "0").replace(",", ".")) * 2),
    [data, manualAmount]
  );

  // ========== UI ==========
  return (
    <Layout>
      {/* LIGHT THEME */}
      <div className="relative min-h-[100dvh] bg-gradient-to-br from-white via-gray-50 to-gray-100 text-slate-900">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60rem_60rem_at_20%_20%,rgba(59,130,246,0.08),transparent_60%),radial-gradient(40rem_40rem_at_80%_0%,rgba(16,185,129,0.08),transparent_60%),radial-gradient(50rem_50rem_at_90%_80%,rgba(168,85,247,0.08),transparent_60%)]" />

        {/* top hint (без кнопки «Отмена», как просил) */}
        <div className="absolute top-16 left-0 right-0 z-20 flex flex-col items-center">
          <div className="text-sm text-slate-600 mt-1">Наведите на QR-код для оплаты</div>
        </div>

        {/* header */}
        <div className="relative px-4 pt-[5.5rem] pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-slate-900/5 ring-1 ring-slate-900/10 backdrop-blur-sm grid place-items-center">
              🔎
            </div>
            <div className="text-lg font-semibold tracking-tight">Сканер QR</div>
          </div>
          <div className="text-xs text-slate-600">2⭐ = 1₽</div>
        </div>

        {/* scanner card */}
        <div className="relative px-4">
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-slate-200 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)] bg-white">
            {waiting ? (
              // === GIF ВМЕСТО КАМЕРЫ ПРИ ОЖИДАНИИ ОПЛАТЫ ===
              <div className="w-full aspect-[3/4] grid place-items-center bg-white">
                <img
                  src="https://i.imgur.com/Z6oUpJQ.gif"
                  alt="Ожидаем оплату"
                  className="w-64 h-auto"
                />
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="w-full aspect-[3/4] bg-black/70 object-cover rounded-3xl"
                  playsInline
                  muted
                  autoPlay
                />
                {/* Framing HUD */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-[72%] aspect-square rounded-3xl border-[3px] border-slate-900/20 shadow-[0_0_30px_rgba(0,0,0,0.08)]" />
                </div>
                {/* Gradient fade at bottom */}
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-white to-transparent" />
                {/* Inline scanning hint */}
                {!data && !error && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs bg-white ring-1 ring-slate-200 text-slate-600 backdrop-blur-md">
                    Сканирование<Dots />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Torch + manual fallback */}
          {!waiting && (
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
          )}
        </div>

        {/* Confirm modal (recognized flow) */}
        {data && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm" />
            <div className="absolute inset-0 [background:radial-gradient(35rem_35rem_at_50%_0%,rgba(59,130,246,0.12),transparent_60%),radial-gradient(30rem_30rem_at_20%_80%,rgba(99,102,241,0.12),transparent_60%)]" />
            <div className="relative w-full max-w-md rounded-3xl overflow-hidden ring-1 ring-slate-200 shadow-2xl">
              <div className="bg-white">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-base font-semibold">Подтверждение оплаты</div>
                  <button
                    onClick={closeModal}
                    className="text-slate-600 hover:text-slate-800 transition-colors"
                    aria-label="Закрыть"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="rounded-2xl p-3 bg-white ring-1 ring-slate-200">
                    <div className="text-xs text-slate-500">Получатель</div>
                    <div className="font-medium truncate">{data.merchant || "Неизвестно"}</div>
                    {data.city ? (
                      <div className="text-xs text-slate-500 mt-0.5">Город: {data.city}</div>
                    ) : null}
                    {data.pan ? (
                      <div className="text-xs text-slate-500 mt-0.5">
                        PAN: <span className="font-mono">{data.pan}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl p-3 bg-white ring-1 ring-slate-200 flex items-center justify-between">
                    <div className="text-slate-700">Сумма</div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{data.amountRub.toLocaleString("ru-RU")} ₽</div>
                      <div className="text-xs text-slate-500">{stars} ⭐</div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 rounded-xl ring-1 ring-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                    >
                      Отказаться
                    </button>
                    <button
                      onClick={pay}
                      disabled={sending}
                      className="px-5 py-2 rounded-xl text-white disabled:opacity-60 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow"
                    >
                      {sending ? "Отправка..." : "Оплатить"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual amount modal (unrecognized) */}
        {showUnrecognizedModal && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm" />
            <div className="relative w-full max-w-md rounded-3xl overflow-hidden ring-1 ring-slate-200 shadow-2xl bg-white text-slate-900">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="text-base font-semibold">QR не распознан</div>
                <button
                  onClick={() => setShowUnrecognizedModal(false)}
                  className="text-slate-600 hover:text-slate-800"
                  aria-label="Закрыть"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-sm text-slate-700">
                  Укажи сумму оплаты, мы сделаем фото, отправим администратору и дождёмся подтверждения.
                </div>
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
                      {manualAmount ? `${Math.max(0, Math.round(Number((manualAmount || "0").replace(",", ".")) * 2))} ⭐` : ""}
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

        {/* Error modal (light) */}
        {error && !showUnrecognizedModal && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm" />
            <div className="relative w-full max-w-md rounded-3xl overflow-hidden ring-1 ring-slate-200 shadow-2xl">
              <div className="bg-white text-slate-900">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-base font-semibold">Не удалось распознать сумму</div>
                  <button onClick={closeModal} className="text-slate-600 hover:text-slate-800" aria-label="Закрыть">
                    ✕
                  </button>
                </div>
                <div className="p-4 text-sm text-slate-700">
                  QR-код не содержит сумму или формат отличается от СБП/EMV.
                </div>
                <div className="p-4 pt-0 flex justify-end">
                  <button
                    onClick={() => {
                      setError(null);
                      setShowUnrecognizedModal(true);
                    }}
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
