"use client";
import Layout from "../components/Layout";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { parseEMVQR } from "../lib/emv";

export default function Scan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [detected, setDetected] = useState<any|null>(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string|null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (res) => {
          if (res && !detected) {
            const text = res.getText();
            const info = parseEMVQR(text);
            setDetected({ text, info });
          }
        });
        controlsRef.current = controls;
      } catch (e:any) {
        setStatus("Нет доступа к камере: " + (e?.message || e));
      }
    })();
    return () => { controlsRef.current?.stop(); };
  }, []);

  const sendToAdmin = async () => {
    if (!detected) return;
    setSending(true);
    try {
      const userId = (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString())
        || localStorage.getItem('user_id')
        || 'anonymous';
      const amount_rub = detected.info?.amount || null;
      const res = await fetch("/api/scan-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          qr_payload: detected.text,
          qr_image_url: "",
          amount_rub,
          max_limit_rub: amount_rub || 0
        })
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("QR отправлен админу. Ожидайте подтверждения.");
    } catch (e:any) {
      setStatus("Ошибка: " + (e?.message || e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout title="Reel Wallet — Сканер">
      <div className="relative max-w-md mx-auto">
        <div className="relative">
          <video ref={videoRef} className="w-full h-auto rounded-b-3xl" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-4 border-white/80 rounded-2xl" style={{boxShadow:'0 0 0 9999px rgba(0,0,0,.4) inset'}}/>
          </div>
          <div className="absolute top-2 left-0 right-0 text-center text-white/90 text-xs">Можем распознать только QR-код с платёжных терминалов</div>
        </div>

        {detected && (
          <div className="px-4 mt-4">
            <div className="bg-white rounded-2xl p-4 shadow">
              <div className="text-sm text-slate-500">Данные QR</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="text-slate-500">Сумма</div><div className="font-semibold">{detected.info?.amount ? `${detected.info.amount} ₽` : '—'}</div>
                <div className="text-slate-500">Валюта</div><div>{detected.info?.currency || '—'}</div>
                <div className="text-slate-500">Мерчант</div><div>{detected.info?.merchant || '—'}</div>
                <div className="text-slate-500">Город</div><div>{detected.info?.city || '—'}</div>
              </div>
              <div className="mt-3 flex gap-2 justify-end">
                <button onClick={sendToAdmin} disabled={sending} className="bg-blue-600 text-white px-4 py-2 rounded-xl">{sending ? 'Отправка...' : 'Оплатить'}</button>
                <button onClick={()=>setDetected(null)} className="bg-slate-200 px-4 py-2 rounded-xl">Отказаться</button>
              </div>
            </div>
          </div>
        )}

        {status && <div className="px-4 mt-3 text-sm text-slate-700">{status}</div>}
      </div>
    </Layout>
  );
}
