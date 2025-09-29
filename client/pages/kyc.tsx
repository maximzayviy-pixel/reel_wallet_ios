// client/pages/kyc.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

// ===== Uploadcare helpers (под твой домен ucarecd.net) =====
const CDN_BASE =
  (process.env.NEXT_PUBLIC_UPLOADCARE_CDN_BASE || "").replace(/\/+$/, "") ||
  "https://ucarecdn.com"; // задай: https://42vi5iz051.ucarecd.net

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const type = /data:(.*?);/.exec(header)?.[1] || "image/jpeg";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function uploadToUploadcare(file: Blob, filename = "file.bin"): Promise<string> {
  const pub = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY;
  if (!pub) throw new Error("NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY is missing");
  const form = new FormData();
  form.append("UPLOADCARE_PUB_KEY", pub);
  form.append("UPLOADCARE_STORE", "1");
  form.append("file", file, filename);
  const r = await fetch("https://upload.uploadcare.com/base/", { method: "POST", body: form });
  const j = await r.json();
  if (!r.ok || !j?.file) throw new Error(j?.error || "Uploadcare error");
  // Формируем ссылку ИМЕННО на твоём CDN-хосте (ucarecd.net поддоменом)
  return `${CDN_BASE}/${j.file}/`;
}

// ===== Камера/видео =====
function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export default function KYCPage() {
  // шаги: 1 лицо, 2 документ, 3 живость, 4 отправка
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [faceDataUrl, setFaceDataUrl] = useState<string | null>(null);
  const [docDataUrl, setDocDataUrl] = useState<string | null>(null);
  const [liveBlob, setLiveBlob] = useState<Blob | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [count, setCount] = useState(0);

  // Чистим камеру при переходах/уходе
  useEffect(() => {
    return () => stopStream(stream);
  }, [stream]);

  // ====== Управление камерой — только по кнопке ======
  const startCamera = async (facingMode: "user" | "environment", withAudio = false) => {
    setMsg(null);
    try {
      stopStream(stream);
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: !!withAudio });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
    } catch (e: any) {
      setMsg(e?.message || "Нет доступа к камере");
    }
  };

  const snap = (w: number, h: number): string | null => {
    const v = videoRef.current;
    if (!v) return null;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.92);
  };

  const handleFaceShot = async () => {
    // круг лучше получается квадратным кадром
    const shot = snap(640, 640);
    if (!shot) return;
    setFaceDataUrl(shot);
    stopStream(stream);
    setStep(2);
  };

  const handleDocShot = async () => {
    const shot = snap(960, 640);
    if (!shot) return;
    setDocDataUrl(shot);
    stopStream(stream);
    setStep(3);
  };

  const startLiveness = async () => {
    try {
      setMsg(null);
      stopStream(stream);
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      chunksRef.current = [];
      const mr = new MediaRecorder(s, { mimeType: "video/webm;codecs=vp8" });
      mr.ondataavailable = (e) => e.data && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setLiveBlob(blob);
      };
      mr.start(250);
      setRec(mr);
      // 5 секунд
      setCount(5);
      const timer = setInterval(() => {
        setCount((c) => {
          if (c <= 1) {
            clearInterval(timer);
            mr.stop();
            stopStream(s);
            setStep(4);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (e: any) {
      setMsg(e?.message || "Не удалось запустить видео");
    }
  };

  const stopRecording = () => {
    if (rec && rec.state === "recording") rec.stop();
    setRec(null);
    stopStream(stream);
  };

  // ===== Отправка =====
  const submit = async () => {
    try {
      setBusy(true);
      setMsg(null);
      const tg = (window as any)?.Telegram?.WebApp;
      const user = tg?.initDataUnsafe?.user;
      if (!user?.id) throw new Error("Не определён Telegram-профиль.");

      if (!faceDataUrl || !docDataUrl) throw new Error("Нужны фото лица и документа.");

      const face_url = await uploadToUploadcare(dataUrlToBlob(faceDataUrl), "face.jpg");
      const doc_url = await uploadToUploadcare(dataUrlToBlob(docDataUrl), "doc.jpg");
      let liveness_url: string | undefined;
      if (liveBlob) liveness_url = await uploadToUploadcare(liveBlob, "live.webm");

      const r = await fetch(`/api/kyc-submit?tg_id=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ face_url, doc_url, liveness_url }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.error || "Не удалось отправить заявку");
      setMsg("Заявка отправлена. Проверка админом.");
    } catch (e: any) {
      setMsg(e?.message || "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="KYC — Reel Wallet">
      <div className="max-w-md mx-auto p-4 space-y-6 pb-28">
        <h1 className="text-lg font-semibold">Верификация личности</h1>

        {/* Шаг 1 — лицо */}
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Шаг 1 — Фото лица</div>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
              {faceDataUrl ? "готово ✓" : "ожидает"}
            </span>
          </div>

          {!faceDataUrl && step === 1 && (
            <>
              <div className="w-40 h-40 rounded-full overflow-hidden ring-2 ring-indigo-100 mx-auto bg-black/5">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              </div>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => startCamera("user", false)}
                  className="px-3 py-2 rounded-xl bg-slate-100"
                >
                  Включить камеру
                </button>
                <button
                  onClick={handleFaceShot}
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white"
                >
                  Сфотографировать
                </button>
              </div>
            </>
          )}

          {faceDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faceDataUrl} alt="face" className="w-40 h-40 rounded-full mx-auto ring-2 ring-indigo-100" />
          )}
        </section>

        {/* Шаг 2 — документ */}
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Шаг 2 — Фото документа</div>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
              {docDataUrl ? "готово ✓" : "ожидает"}
            </span>
          </div>

          {!docDataUrl && step === 2 && (
            <>
              <div className="rounded-xl overflow-hidden ring-1 ring-slate-200 bg-black/5">
                <video ref={videoRef} playsInline muted className="w-full h-56 object-cover" />
              </div>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => startCamera("environment", false)}
                  className="px-3 py-2 rounded-xl bg-slate-100"
                >
                  Включить камеру
                </button>
                <button
                  onClick={handleDocShot}
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white"
                >
                  Сфотографировать
                </button>
              </div>
            </>
          )}

          {docDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={docDataUrl} alt="doc" className="w-full rounded-xl ring-1 ring-slate-200" />
          )}
        </section>

        {/* Шаг 3 — живость */}
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Шаг 3 — Живость (видео)</div>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
              {liveBlob ? "готово ✓" : "по желанию"}
            </span>
          </div>

          {step === 3 && (
            <>
              <div className="rounded-xl overflow-hidden ring-1 ring-slate-200 bg-black/5">
                <video ref={videoRef} playsInline muted className="w-full h-56 object-cover" />
              </div>
              <div className="flex justify-center gap-2">
                <button
                  onClick={startLiveness}
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white disabled:bg-slate-300"
                  disabled={!!rec}
                >
                  Записать {count ? `(${count})` : ""}
                </button>
                <button
                  onClick={stopRecording}
                  className="px-3 py-2 rounded-xl bg-slate-100"
                  disabled={!rec}
                >
                  Стоп
                </button>
              </div>
            </>
          )}

          {liveBlob && (
            <div className="text-xs text-slate-600">
              Видео записано ({Math.round(liveBlob.size / 1024)} КБ)
            </div>
          )}
        </section>

        {/* Шаг 4 — отправка */}
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="font-medium">Отправка</div>
          <button
            onClick={submit}
            disabled={busy || !faceDataUrl || !docDataUrl}
            className={`w-full px-4 py-2 rounded-xl text-white ${
              busy || !faceDataUrl || !docDataUrl
                ? "bg-slate-300"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            Отправить заявку
          </button>
          {msg && <div className="text-sm text-slate-700">{msg}</div>}
        </section>
      </div>
    </Layout>
  );
}
