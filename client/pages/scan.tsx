"use client";
import Layout from "../components/Layout";
import useBanRedirect from "../lib/useBanRedirect";
import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  BrowserQRCodeReader,
  IScannerControls,
} from "@zxing/browser";
import { parseEMVQR, parseSBPLink } from "../lib/emv";

// ---------------- UI-only types ----------------
type ScanData = {
  raw: string;
  merchant?: string;
  pan?: string;
  city?: string;
  amountRub: number;
};

export default function Scan() {
  // Redirect banned users to banned page
  useBanRedirect();

  // ---------------- refs & state (logic unchanged) ----------------
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const fallbackUsed = useRef(false);
  const [data, setData] = useState<ScanData | null>(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---------------- camera & decoding (logic unchanged) ----------------
  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!videoRef.current) return;
      try {
        const reader = new BrowserMultiFormatReader();
        // Dedicated QR reader for fallback
        const qrReader = new BrowserQRCodeReader();

        const processRaw = (raw: string) => {
          let rub: number | null = null;
          let merchant = "";
          let pan = "";
          let city = "";

          const sbp = parseSBPLink(raw);
          if (sbp?.amount) rub = sbp.amount;

          const emv = parseEMVQR(raw);
          if (emv) {
            merchant = emv.merchant || merchant;
            city = emv.city || city;
            pan = emv.account || (emv as any)?.nodes?.["26"]?.["01"] || "";
            if (rub === null && typeof emv.amount === "number") {
              rub = emv.amount;
            }
          }

          if (!rub || rub <= 0) {
            setError("Не удалось определить сумму из QR.");
          } else {
            setData({ raw, merchant, pan, city, amountRub: rub });
          }
        };

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          async (res, err, controls) => {
            if (disposed) return;
            if (res?.getText()) {
              controls.stop();
              controlsRef.current = controls;
              const raw = res.getText();
              processRaw(raw);
              return;
            }
            if (err && !fallbackUsed.current) {
              fallbackUsed.current = true;
              try {
                if (
                  typeof window !== "undefined" &&
                  (window as any).BarcodeDetector &&
                  videoRef.current
                ) {
                  const detector = new (window as any).BarcodeDetector({
                    formats: ["qr_code"],
                  });
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes && barcodes[0] && barcodes[0].rawValue) {
                    const raw = barcodes[0].rawValue as string;
                    controls.stop();
                    controlsRef.current = controls;
                    processRaw(raw);
                    fallbackUsed.current = false;
                    return;
                  }
                }
              } catch {
                // ignore BarcodeDetector errors
              }
              try {
                if (videoRef.current) {
                  const result = await qrReader.decodeOnceFromVideoElement(
                    videoRef.current
                  );
                  const raw = result?.getText();
                  if (raw) {
                    controls.stop();
                    controlsRef.current = controls;
                    processRaw(raw);
                  }
                }
              } catch {
                // ignore
              } finally {
                fallbackUsed.current = false;
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
      disposed = true;
      try {
        controlsRef.current?.stop();
      } catch {}
    };
  }, []);

  // ---------------- helpers (logic unchanged) ----------------
  const takeSnapshot = (): string | null => {
    const v = videoRef.current;
    if (!v) return null;
    const canvas = document.createElement("canvas");
    const w = v.videoWidth || 720;
    const h = v.videoHeight || 1280;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    try {
      return canvas.toDataURL("image/jpeg", 0.92);
    } catch {
      return canvas.toDataURL("image/png");
    }
  };

  const closeModal = () => {
    setData(null);
    setError(null);
    setStatus(null);
  };

  async function pay() {
    if (!data) return;
    const uidRaw =
      typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
    const tg_id = uidRaw ? Number(uidRaw) : null;
    if (!tg_id) {
      setStatus("Не найден tg_id (открой через Telegram WebApp).");
      return;
    }

    setSending(true);
    setStatus(null);
    try {
      const qr_image_b64 = takeSnapshot();
      const payload: any = {
        tg_id,
        qr_payload: data.raw,
        amount_rub: data.amountRub,
        qr_image_b64,
      };
      const tgInit =
        typeof window !== "undefined"
          ? (window as any).Telegram?.WebApp?.initData
          : "";
      const res = await fetch("/api/scan-submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": tgInit || "",
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        if (json?.reason === "INSUFFICIENT_BALANCE") {
          setStatus(`Недостаточно ⭐: нужно ${json.need}, у вас только ${json.have}.`);
        } else if (json?.reason === "NO_USER") {
          setStatus("Не найден профиль. Перезапусти бота в Telegram.");
        } else {
          setStatus(`Ошибка: ${json?.reason || json?.error || "неизвестная"}`);
        }
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

  const stars = data ? Math.round(data.amountRub * 2) : 0;

  // ---------------- UI ----------------
  return (
    <Layout>
      {/* Background gradients */}
      <div className="relative min-h-[100dvh] text-slate-100 overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-24 h-[36rem] w-[36rem] rounded-full blur-3xl opacity-20 bg-gradient-to-br from-blue-500/60 to-indigo-400/60" />
          <div className="absolute -bottom-40 -right-24 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-20 bg-gradient-to-tr from-emerald-400/50 to-violet-400/50" />
        </div>

        {/* Top bar */}
        <div className="relative z-20 flex items-center justify-between px-4 pt-5 pb-3">
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
            className="text-sm text-white/90 hover:text-white"
            aria-label="Назад"
          >
            Отмена
          </button>
          <div className="text-xs text-slate-300">2⭐ = 1₽</div>
        </div>

        {/* Headline */}
        <div className="relative z-20 px-4">
          <div className="text-[22px] leading-tight font-semibold tracking-tight">Сканер QR</div>
          <div className="text-sm text-slate-300 mt-1">Наведите камеру на QR‑код для оплаты</div>
        </div>

        {/* Scanner viewport */}
        <div className="relative z-10 px-4 mt-4">
          <div className="relative overflow-hidden rounded-[28px] ring-1 ring-white/10 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)] bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-sm">
            <video
              ref={videoRef}
              className="w-full aspect-[3/4] object-cover bg-black/70 rounded-[28px]"
              playsInline
              muted
              autoPlay
            />

            {/* Framing HUD (corners + subtle mask) */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative w-[74%] max-w-[520px] aspect-square">
                {/* outer glow ring */}
                <div className="absolute inset-0 rounded-[22px] ring-2 ring-white/80 shadow-[0_0_30px_rgba(0,0,0,0.5)]" />
                {/* corner cuts */}
                <div className="absolute -inset-[10%]">
                  <div className="hud-corner top-0 left-0" />
                  <div className="hud-corner top-0 right-0 rotate-90" />
                  <div className="hud-corner bottom-0 right-0 rotate-180" />
                  <div className="hud-corner bottom-0 left-0 -rotate-90" />
                </div>
                {/* animated scanline */}
                <div className="scanline absolute left-0 right-0 top-1/2 -translate-y-1/2 opacity-90">
                  <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-white to-transparent" />
                </div>
              </div>
            </div>

            {/* bottom fade */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-slate-950/80 to-transparent" />

            {/* floating flashlight button */}
            <div className="absolute right-4 top-4 z-10">
              <button
                onClick={() => {
                  try {
                    const haptics: any = (window as any)?.Telegram?.WebApp?.HapticFeedback;
                    haptics?.impactOccurred?.("light");
                  } catch {}
                }}
                className="w-11 h-11 rounded-full grid place-items-center bg-white/10 ring-1 ring-white/25 backdrop-blur-md text-white text-lg shadow-lg"
                aria-label="Фонарик"
              >
                🔦
              </button>
            </div>
          </div>
        </div>

        {/* Status toast (inline) */}
        {status && (
          <div className="relative z-20 px-4 mt-3">
            <div className="rounded-2xl px-3 py-2 bg-white/10 ring-1 ring-white/15 text-sm text-slate-100/95 backdrop-blur">
              {status}
            </div>
          </div>
        )}

        {/* Payment bottom sheet */}
        {data && (
          <div className="fixed inset-0 z-50">
            {/* dim backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />

            {/* sheet */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-5">
              <div className="mx-auto w-full max-w-md rounded-3xl overflow-hidden ring-1 ring-white/15 shadow-2xl bg-gradient-to-br from-white/85 to-white/70 text-slate-900 backdrop-blur-xl animate-slideUp">
                <div className="p-4 border-b border-white/40 flex items-center justify-between">
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
                  <div className="rounded-2xl p-3 bg-white/70 ring-1 ring-black/5">
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

                  <div className="rounded-2xl p-3 bg-white/70 ring-1 ring-black/5 flex items-center justify-between">
                    <div className="text-slate-600">Сумма</div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{data.amountRub.toLocaleString("ru-RU")} ₽</div>
                      <div className="text-xs text-slate-500">{Math.round(data.amountRub * 2)} ⭐</div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 rounded-xl ring-1 ring-slate-300/70 text-slate-700 bg-white/60 hover:bg-white transition-colors"
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

        {/* Error modal */}
        {error && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
            <div className="relative w-full max-w-md rounded-3xl overflow-hidden ring-1 ring-white/15 shadow-2xl">
              <div className="bg-gradient-to-br from-white/90 to-white/70 text-slate-900 backdrop-blur-xl">
                <div className="p-4 border-b border-white/40 flex items-center justify-between">
                  <div className="text-base font-semibold">Не удалось распознать сумму</div>
                  <button
                    onClick={closeModal}
                    className="text-slate-600 hover:text-slate-800 transition-colors"
                    aria-label="Закрыть"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4 text-sm text-slate-700">
                  QR-код не содержит сумму или формат отличается от СБП/EMV.
                </div>
                <div className="p-4 pt-0 flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 rounded-xl ring-1 ring-slate-300/70 text-slate-700 bg-white/70 hover:bg-white transition-colors"
                  >
                    Понял
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Local animations / HUD corners */}
      <style jsx global>{`
        @keyframes scan {
          0% { transform: translateY(-42%); opacity: 0.25; }
          50% { opacity: 1; }
          100% { transform: translateY(42%); opacity: 0.25; }
        }
        .scanline { animation: scan 2.2s ease-in-out infinite alternate; }
        .hud-corner { position:absolute; width:56px; height:56px; border:4px solid rgba(255,255,255,0.9); border-radius:20px; }
        .hud-corner::before, .hud-corner::after { content:""; position:absolute; background: transparent; }
        /* hide inner edges so only corners remain */
        .hud-corner { box-shadow: inset 0 0 0 999px rgba(0,0,0,0); }
        .hud-corner { clip-path: polygon(0 0, 45% 0, 45% 18%, 18% 18%, 18% 45%, 0 45%); }
        @keyframes slideUp { from { transform: translateY(18px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slideUp { animation: slideUp .18s ease-out; }
      `}</style>
    </Layout>
  );
}
