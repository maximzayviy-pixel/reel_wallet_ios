"use client";
import Layout from "../components/Layout";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { parseEMVQR, parseSBPLink } from "../lib/emv";

type ScanData = {
  raw: string;
  merchant?: string;
  pan?: string;
  city?: string;
  amountRub: number;
};

export default function Scan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [data, setData] = useState<ScanData | null>(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!videoRef.current) return;
      try {
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (res, err, controls) => {
            if (disposed) return;
            if (res?.getText()) {
              controls.stop();
              controlsRef.current = controls;
              const raw = res.getText();

              let rub: number | null = null;
              let merchant = "",
                pan = "",
                city = "";

              const sbp = parseSBPLink(raw);
              if (sbp?.amount) rub = sbp.amount;

              const emv = parseEMVQR(raw);
              if (emv) {
                merchant = emv.merchant || merchant;
                city = emv.city || city;
                pan = emv.account || emv?.nodes?.["26"]?.["01"] || "";
                if (rub === null && typeof emv.amount === "number") {
                  rub = emv.amount;
                }
              }

              if (!rub || rub <= 0) {
                setError("Не удалось определить сумму из QR.");
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
      disposed = true;
      try {
        controlsRef.current?.stop();
      } catch {}
    };
  }, []);

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
      const res = await fetch("/api/scan-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        if (json?.reason === "INSUFFICIENT_BALANCE") {
          setStatus(
            `Недостаточно ⭐: нужно ${json.need}, у вас только ${json.have}.`
          );
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

  return (
    <Layout>
      <div className="relative min-h-[100dvh] bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-900">
        {/* Top bar with only rate info */}
        <div className="relative px-4 pt-5 pb-3 flex items-center justify-end">
          <div className="text-xs text-slate-500">2⭐ = 1₽</div>
        </div>

        {/* Scanner card */}
        <div className="relative px-4">
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-slate-200 shadow-md bg-white">
            <video
              ref={videoRef}
              className="w-full aspect-[3/4] bg-black object-cover rounded-3xl"
              playsInline
              muted
              autoPlay
            />
            {/* Framing HUD */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-[72%] aspect-square rounded-3xl border-[3px] border-blue-500/70 shadow-[0_0_30px_rgba(0,0,0,0.3)]" />
            </div>
            {/* Watermark */}
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-6">
              <div className="text-2xl font-bold text-white/50 select-none">Reel Wallet</div>
            </div>
          </div>
        </div>

        {status && (
          <div className="relative px-4 mt-3 text-sm text-slate-700">{status}</div>
        )}

        {data && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-white">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-base font-semibold">Подтверждение оплаты</div>
                  <button
                    onClick={closeModal}
                    className="text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="rounded-xl p-3 bg-slate-50 ring-1 ring-slate-200">
                    <div className="text-xs text-slate-500">Получатель</div>
                    <div className="font-medium">{data.merchant || "Неизвестно"}</div>
                    {data.city && <div className="text-xs text-slate-500 mt-0.5">Город: {data.city}</div>}
                    {data.pan && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        PAN: <span className="font-mono">{data.pan}</span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl p-3 bg-slate-50 ring-1 ring-slate-200 flex items-center justify-between">
                    <div className="text-slate-600">Сумма</div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{data.amountRub.toLocaleString("ru-RU")} ₽</div>
                      <div className="text-xs text-slate-500">{stars} ⭐</div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                    >
                      Отказаться
                    </button>
                    <button
                      onClick={pay}
                      disabled={sending}
                      className={[
                        "relative px-5 py-2 rounded-xl text-white shadow min-w-[13rem]",
                        "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600",
                        "disabled:opacity-90 disabled:cursor-not-allowed",
                        "overflow-hidden inline-flex items-center justify-center gap-2"
                      ].join(" ")}
                    >
                      {/* animated shine + top bar when sending */}
                      {sending && (
                        <>
                          <span
                            className="pointer-events-none absolute inset-0 opacity-35"
                            style={{
                              backgroundImage:
                                "linear-gradient(110deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.25) 45%, rgba(255,255,255,0) 60%)",
                              backgroundSize: "200% 100%",
                              animation: "shimmer 1.6s linear infinite"
                            }}
                          />
                          <span
                            className="pointer-events-none absolute left-0 top-0 h-[2px] bg-white/80"
                            style={{
                              width: "30%",
                              animation: "bar 1.8s ease-in-out infinite"
                            }}
                          />
                        </>
                      )}

                      {sending ? (
                        <>
                          <span
                            className="inline-block h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin"
                            aria-hidden="true"
                          />
                          <span className="font-medium tracking-wide">Ожидаем оплату</span>
                          <span className="sr-only" aria-live="polite">Платёж обрабатывается</span>
                        </>
                      ) : (
                        <span className="font-medium tracking-wide">Оплатить</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-white">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-base font-semibold">Не удалось распознать сумму</div>
                  <button
                    onClick={closeModal}
                    className="text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4 text-sm text-slate-600">
                  QR-код не содержит сумму или формат отличается от СБП/EMV.
                </div>
                <div className="p-4 pt-0 flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                  >
                    Понял
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
      {/* Local animations for button shimmer/progress */}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -120% 0; }
          100% { background-position: 120% 0; }
        }
        @keyframes bar {
          0% { transform: translateX(-120%); width: 20%; }
          50% { transform: translateX(60%); width: 60%; }
          100% { transform: translateX(160%); width: 20%; }
        }
      `}</style>
    </Layout>
  );
}
