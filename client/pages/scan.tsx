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
  amountRub: number; // parsed RUB
};

export default function Scan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [data, setData] = useState<ScanData | null>(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // init camera and ZXing
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

              // Parse SBP & EMV
              let rub: number | null = null;
              let merchant = "", pan = "", city = "";
              const sbp = parseSBPLink(raw);
              if (sbp?.amount) rub = sbp.amount;

              const emv = parseEMVQR(raw);
              if (emv) {
                merchant = emv.merchant || merchant;
                city = emv.city || city;
                pan = emv.account || emv?.nodes?.["26"]?.["01"] || "";
                if (rub === null && typeof emv.amount === "number") {
                  // EMV amount is usually in currency units (RUB)
                  rub = emv.amount;
                }
              }

              if (!rub || rub <= 0) {
                setError("Не удалось определить сумму из QR. Убедись, что QR содержит сумму.");
              } else {
                setData({ raw, merchant, pan, city, amountRub: rub });
              }
            }
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        console.error(e);
        setStatus("Не удалось получить доступ к камере. Проверь разрешения.");
      }
    })();
    return () => { disposed = true; try { controlsRef.current?.stop(); } catch {} };
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

  const closeModal = () => {
    setData(null);
    setError(null);
    setStatus(null);
    // optionally resume scanning
    try { controlsRef.current?.stop(); } catch {}
  };

  async function pay() {
    if (!data) return;
    const uidRaw = (typeof window !== "undefined") ? localStorage.getItem("user_id") : null;
    const tg_id = uidRaw ? Number(uidRaw) : null;
    if (!tg_id) { setStatus("Не найден tg_id (WebApp). Открой через Telegram WebApp."); return; }

    setSending(true);
    setStatus(null);
    try {
      const qr_image_b64 = takeSnapshot();
      const payload: any = {
        tg_id,
        qr_payload: data.raw,
        amount_rub: data.amountRub,
        max_limit_rub: null,
        qr_image_b64,
      };
      const res = await fetch("/api/scan-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "scan-submit failed");
      setStatus(json?.admin_notified ? "✅ Отправлено админу" : "⚠️ Запрос сохранён, но админ недоступен");
      setData(null);
    } catch (e:any) {
      setStatus(`Ошибка: ${e?.message || String(e)}`);
    } finally {
      setSending(false);
    }
  }

  const stars = data ? Math.round(data.amountRub * 2) : 0;

  return (
    <Layout>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="text-lg font-semibold">Сканер QR</div>
        <div className="text-xs text-slate-500">2⭐ = 1₽</div>
      </div>

      {/* Camera */}
      <div className="px-4">
        <div className="relative rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-200">
          <video ref={videoRef} className="w-full aspect-[3/4] bg-black object-cover" playsInline muted autoPlay />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[72%] aspect-square rounded-2xl border-[3px] border-white/80 shadow-[0_0_30px_rgba(0,0,0,0.4)]" />
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      </div>

      {status && <div className="px-4 mt-3 text-sm text-slate-700">{status}</div>}

      {/* Modal: parsed data */}
      {data && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="w-full sm:max-w-md sm:rounded-2xl sm:shadow-xl sm:mx-auto bg-white rounded-t-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-base font-semibold">Подтверждение оплаты</div>
              <button onClick={closeModal} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Получатель</div>
                <div className="font-medium">{data.merchant || "Неизвестно"}</div>
                {data.city ? <div className="text-xs text-slate-500 mt-0.5">Город: {data.city}</div> : null}
                {data.pan ? <div className="text-xs text-slate-500 mt-0.5">PAN: <span className="font-mono">{data.pan}</span></div> : null}
              </div>

              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <div className="text-slate-600">Сумма</div>
                <div className="text-right">
                  <div className="text-lg font-semibold">{data.amountRub.toLocaleString("ru-RU")} ₽</div>
                  <div className="text-xs text-slate-500">{stars} ⭐</div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={closeModal} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl">Отмена</button>
                <button onClick={pay} disabled={sending} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl disabled:opacity-60">
                  {sending ? "Отправка..." : "Оплатить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: parse error */}
      {error && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="w-full sm:max-w-md sm:rounded-2xl sm:shadow-xl sm:mx-auto bg-white rounded-t-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-base font-semibold">Не удалось распознать сумму</div>
              <button onClick={closeModal} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <div className="text-sm text-slate-600">
              QR-код не содержит сумму или формат отличается от СБП/EMV с суммой.
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={closeModal} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl">Понял</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
