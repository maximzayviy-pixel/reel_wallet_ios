"use client";
import Layout from "../components/Layout";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { parseEMVQR, parseSBPLink } from "../lib/emv";

type DetectedPayload = {
  raw?: string;
  qr?: string;
  info?: {
    merchant?: string;
    pan?: string;
    city?: string;
  };
  presetRub?: number | null;
};

export default function Scan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [detected, setDetected] = useState<DetectedPayload | null>(null);
  const [starsInput, setStarsInput] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Camera init with ZXing
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
              controls.stop();
              controlsRef.current = controls;
              const raw = res.getText();

              // Try both EMV and SBP parsers
              let presetRub: number | null = null;
              let merchant = "";
              let pan = "";
              let city = "";
              const sbp = parseSBPLink(raw);
              if (sbp?.amount) {
                presetRub = sbp.amount;
              }
              const info = parseEMVQR(raw);
              if (info) {
                merchant = info?.merchant || merchant;
                pan = info?.account || info?.nodes?.["26"]?.["01"] || "";
                city = info?.city || city;
                if (!presetRub && typeof info?.amount === "number") {
                  presetRub = info.amount;
                }
              }

              const starsFromRub = presetRub ? Math.round(presetRub * 2) : 0;
              setStarsInput(starsFromRub ? String(starsFromRub) : "");

              setDetected({
                raw,
                qr: raw,
                info: { merchant, pan, city },
                presetRub,
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
      try { controlsRef.current?.stop(); } catch {}
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
    try { return canvas.toDataURL("image/jpeg", 0.92); }
    catch { return canvas.toDataURL("image/png"); }
  };

  async function sendToAdmin() {
    if (!detected) return;
    const stars = Number(starsInput);
    if (!Number.isFinite(stars) || stars <= 0) { alert("Введите корректную сумму в ⭐"); return; }
    const amount_rub = stars / 2; // 2⭐ = 1₽

    setSending(true);
    setStatus(null);
    try {
      const qr_image_b64 = takeSnapshot();
      const payload: any = {
        tg_id: null,
        user_id: null,
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
      if (!res.ok || !data?.ok) throw new Error(data?.error || "scan-submit failed");

      setStatus(data?.admin_notified ? "✅ Отправлено админу" : "⚠️ Запрос сохранён, но админ недоступен");
      setDetected(null);
      setStarsInput("");
      try { controlsRef.current?.stop(); } catch {}
    } catch (e:any) {
      setStatus(`Ошибка: ${e?.message || String(e)}`);
    } finally {
      setSending(false);
    }
  }

  const presetStars = detected?.presetRub ? Math.round((detected.presetRub || 0) * 2) : null;

  return (
    <Layout>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="text-lg font-semibold">Сканер QR</div>
        <div className="text-xs text-slate-500">2⭐ = 1₽</div>
      </div>

      {/* Camera with overlay */}
      <div className="px-4">
        <div className="relative rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-200">
          <video
            ref={videoRef}
            className="w-full aspect-[3/4] bg-black object-cover"
            playsInline muted autoPlay
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[72%] aspect-square rounded-2xl border-[3px] border-white/80 shadow-[0_0_30px_rgba(0,0,0,0.4)]" />
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      </div>

      {/* Bottom sheet */}
      <div className="mt-4 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
          {!detected && (
            <div className="text-slate-600 text-sm">
              Наведи камеру на QR-код. Когда QR распознается — появится карточка с данными.
            </div>
          )}

          {detected && (
            <div className="space-y-4">
              {/* Pills row */}
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

              {/* Amount */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-slate-600">Сумма в ⭐</label>
                  {presetStars ? (
                    <span className="text-xs text-slate-500">распознано из QR: ≈ {presetStars} ⭐</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={presetStars ? String(presetStars) : "Например: 200"}
                    value={starsInput}
                    onChange={(e) => setStarsInput(e.target.value.replace(/[^\d.]/g, ""))}
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-lg outline-none focus:border-blue-500"
                  />
                  <div className="text-slate-500 text-sm min-w-[90px] text-right">
                    ≈ {(Number(starsInput || (presetStars || 0)) / 2).toLocaleString("ru-RU")} ₽
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setDetected(null); setStarsInput(""); setStatus(null); }}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl"
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
