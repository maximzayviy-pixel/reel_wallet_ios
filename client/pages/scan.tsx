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
      {/* Page background */}
      <div className="relative min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-850 to-slate-800 text-slate-100">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60rem_60rem_at_20%_20%,rgba(37,99,235,0.12),transparent_60%),radial-gradient(40rem_40rem_at_80%_0%,rgba(16,185,129,0.12),transparent_60%),radial-gradient(50rem_50rem_at_90%_80%,rgba(168,85,247,0.10),transparent_60%)]" />

        {/* Top bar */}
        <div className="relative px-4 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm grid place-items-center">🔎</div>
            <div className="text-lg font-semibold tracking-tight">Сканер QR</div>
          </div>
          <div className="text-xs text-slate-300">2⭐ = 1₽</div>
        </div>

        {/* Scanner card */}
        <div className="relative px-4">
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] bg-gradient-to-b from-white/5 to-white/[0.03] backdrop-blur-sm">
            <video
              ref={videoRef}
              className="w-full aspect-[3/4] bg-black/70 object-cover rounded-3xl"
              playsInline
              muted
              autoPlay
            />

            {/* Framing HUD */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-[72%] aspect-square rounded-3xl border-[3px] border-white/80 shadow-[0_0_30px_rgba(0,0,0,0.5)]" />
            </div>

            {/* Gradient fade at bottom */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-slate-900/80 to-transparent" />
          </div>
        </div>

        {/* Inline status text */}
        {status && (
          <div className="relative px-4 mt-3 text-sm text-slate-200/90">
            {status}
          </div>
        )}

        {/* Payment confirmation modal */}
        {data && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            {/* Overlay with soft gradient */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="absolute inset-0 [background:radial-gradient(35rem_35rem_at_50%_0%,rgba(59,130,246,0.25),transparent_60%),radial-gradient(30rem_30rem_at_20%_80%,rgba(99,102,241,0.25),transparent_60%)]" />

            <div className="relative w-full max-w-md rounded-3xl overflow-hidden ring-1 ring-white/15 shadow-2xl">
              <div className="bg-gradient-to-br from-white/85 to-white/70 text-slate-900 backdrop-blur-xl">
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
                    <div className="font-medium truncate">
                      {data.merchant || "Неизвестно"}
                    </div>
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
                      <div className="text-lg font-semibold">
                        {data.amountRub.toLocaleString("ru-RU")} ₽
                      </div>
                      <div className="text-xs text-slate-500">{stars} ⭐</div>
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
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
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
    </Layout>
  );
}
