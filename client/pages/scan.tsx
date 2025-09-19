"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamStarted, setStreamStarted] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>(""); // если QR статический — укажем лимит

  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreamStarted(true);
        }
      } catch (e) {
        setMessage("Не удалось открыть камеру. Разреши доступ к камере.");
      }
    }
    start();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const s = videoRef.current.srcObject as MediaStream;
        s.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const captureAndSend = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setSending(true);
    setMessage(null);
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise(resolve => c.toBlob(b => resolve(b), "image/jpeg", 0.9));
    if (!blob) { setSending(false); return; }

    // загружаем в Supabase Storage (нужно создать bucket: qr-shots, public = true или выдавать signed URL)
    const userId = localStorage.getItem("user_id") || "anonymous";
    const filename = `${userId}-${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from("qr-shots").upload(filename, blob, {
      cacheControl: "3600",
      upsert: false
    });
    if (uploadError) { setMessage("Ошибка загрузки в Storage: " + uploadError.message); setSending(false); return; }

    const { data: pub } = supabase.storage.from("qr-shots").getPublicUrl(filename);
    const qr_image_url = pub?.publicUrl || "";

    // без распознавания payload на клиенте: отправляем только фото + опциональную сумму/лимит
    const payloadText = ""; // можно добавить распознавание позже
    const res = await fetch("/api/scan-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        qr_payload: payloadText,
        qr_image_url,
        amount_rub: amount ? Number(amount) : null,
        max_limit_rub: amount ? Number(amount) : 2000 // дефолтный лимит
      })
    });
    if (!res.ok) {
      const t = await res.text();
      setMessage("Ошибка отправки: " + t);
      setSending(false);
      return;
    }
    setMessage("Заявка отправлена администратору. Ожидайте подтверждения.");
    setSending(false);
  };

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-3">Сканер СБП</h1>
      <div className="mb-2">
        <label className="block text-sm mb-1">Сумма / Лимит (₽):</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border rounded px-3 py-2 w-full"
          placeholder="например, 2500"
        />
      </div>
      <div className="rounded overflow-hidden bg-black">
        <video ref={videoRef} playsInline className="w-full h-auto" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <button
        onClick={captureAndSend}
        disabled={!streamStarted || sending}
        className="mt-4 bg-green-600 text-white px-4 py-2 rounded"
      >
        {sending ? "Отправка..." : "Сфоткать QR и отправить"}
      </button>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
}
