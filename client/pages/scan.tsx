"use client";
import Layout from "../components/Layout";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { parseEMVQR } from "../lib/emv";

type DetectedPayload = {
  raw?: string;
  qr?: string;
  tg_id?: string | number | null;
  user_id?: string | number | null;
  amount_rub?: number | null;
  max_limit_rub?: number | null;
  info?: {
    merchant?: string;
    pan?: string;
    city?: string;
  };
};

export default function Scan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [detected, setDetected] = useState<DetectedPayload | null>(null);
  const [starsInput, setStarsInput] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Camera init
  useEffect(() => {
    (async () => {
      if (!videoRef.current) return;
      try {
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (res, err, controls) => {
            if (res?.getText()) {
              // stop scanning
              controls.stop();
              controlsRef.current = controls;
              const raw = res.getText();
              const info = parseEMVQR(raw);
              setDetected({
                raw,
                qr: raw,
                info: {
                  merchant: info?.merchantName || info?.merchant || "",
                  pan: info?.cardNumber || info?.PAN || "",
                  city: info?.city || "",
                },
                amount_rub: null,
                max_limit_rub: null,
                tg_id: null,
                user_id: null,
              });
            }
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        console.error(e);
        setStatus("Не удалось получить доступ к камере. Проверь разрешения.");
      }
    })();

    return () => {
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
      return canvas.toDataURL("image/jpeg", 0.9);
    } catch {
      return canvas.toDataURL("image/png");
    }
  };

  async function sendToAdmin() {
    if (!detected) return;
    const stars = Number(starsInput);
    if (!Number.isFinite(stars) || stars <= 0) {
      alert("Введите корректную сумму в ⭐");
      return;
    }
    // 2⭐ = 1₽
    const amount_rub = stars / 2;

    setSending(true);
    setStatus(null);
    try {
      const qr_image_b64 = takeSnapshot();
      const payload: any = {
        tg_id: detected?.tg_id || null,
        user_id: detected?.user_id || null,
        qr_payload: detected?.raw || detected?.qr || null,
        amount_rub,
        max_limit_rub: null,
        qr_image_b64,
      };
      const res = await fetch("/api/scan-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "scan-submit failed");
      }
      setStatus(data?.admin_notified ? "✅ Отправлено админу" : "⚠️ Запрос сохранён, но админ недоступен");
      setDetected(null);
      setStarsInput("");
      // перезапустим камеру для следующего скана
      try {
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (res, err, controls) => {
            if (res?.getText()) {
              controls.stop();
              controlsRef.current = controls;
              const raw = res.getText();
              const info = parseEMVQR(raw);
              setDetected({
                raw,
                qr: raw,
                info: {
                  merchant: info?.merchantName || info?.merchant || "",
                  pan: info?.cardNumber || info?.PAN || "",
                  city: info?.city || "",
                },
                amount_rub: null,
                max_limit_rub: null,
                tg_id: null,
                user_id: null,
              });
            }
          }
        );
        controlsRef.current = controls;
      } catch {}
    } catch (e: any) {
      setStatus(`Ошибка: ${e?.message || String(e)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <Layout>
      {/* Top bar */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="text-lg font-semibold">Сканер QR</div>
        <div className="text-xs text-slate-500">⭐ → 2⭐ = 1₽</div>
      </div>

      {/* Camera block */}
      <div className="px-4">
        <div className="relative rounded-2xl overflow-hidden shadow-sm">
          <video
            ref={videoRef}
            className="w-full aspect-[3/4] bg-black object-cover"
            playsInline
            muted
            autoPlay
          />
          {/* overlay frame */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[70%] aspect-square rounded-2xl border-4 border-white/80 shadow-lg" />
          </div>
          {/* bottom gradient */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      </div>

      {/* Info panel / bottom sheet */}
      <div className="mt-4 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
          {!detected && (
            <div className="text-slate-600 text-sm">
              Наведи камеру на QR-код. Когда QR распознается — появится карточка с данными.
            </div>
          )}

          {detected && (
            <div className="space-y-4">
              {/* Merchant pill row */}
              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm">
                  <span className="mr-1 opacity-60">Мерчант</span>
                  <span className="font-medium">{detected.info?.merchant || "—"}</span>
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm">
                  <span className="mr-1 opacity-60">Город</span>
                  <span className="font-medium">{detected.info?.city || "—"}</span>
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm">
                  <span className="mr-1 opacity-60">PAN</span>
                  <span className="font-mono">{detected.info?.pan || "—"}</span>
                </span>
              </div>

              {/* Amount input in ⭐ */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">Сумма в ⭐</label>
                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Например: 200"
                    value={starsInput}
                    onChange={(e) => setStarsInput(e.target.value.replace(/[^\d.]/g, ""))}
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-lg outline-none focus:border-blue-500"
                  />
                  <div className="text-slate-500 text-sm">
                    ≈ {(Number(starsInput || 0) / 2 || 0).toLocaleString("ru-RU")} ₽
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setDetected(null);
                    setStarsInput("");
                    setStatus(null);
                    // try to resume camera if user cancels
                    try {
                      controlsRef.current?.stop();
                    } catch {}
                  }}
                  className="bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-xl"
                >
                  Отмена
                </button>
                <button
                  onClick={sendToAdmin}
                  disabled={sending}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl disabled:opacity-60"
                >
                  {sending ? "Отправка..." : "Оплатить"}
                </button>
              </div>
            </div>
          )}

          {status && <div className="mt-3 text-sm text-slate-700">{status}</div>}
        </div>
      </div>
    </Layout>
  );
}
