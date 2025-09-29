"use client";
import { useEffect, useRef, useState } from "react";

export default function LivenessRecorder({
  onRecorded,
  maxMs = 5000, // 5 сек
}: {
  onRecorded: (blob: Blob) => void;
  maxMs?: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [count, setCount] = useState<number>(0);
  const chunks = useRef<BlobPart[]>([]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e: any) {
        setErr(e?.message || "Нет доступа к камере");
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (!stream) return;
    chunks.current = [];
    const mr = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
    mr.ondataavailable = (e) => e.data && chunks.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks.current, { type: "video/webm" });
      onRecorded(blob);
    };
    mr.start(250);
    setRec(mr);
    setCount(Math.ceil(maxMs / 1000));

    // простой таймер
    const timer = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(timer);
          mr.stop();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const stop = () => rec?.state === "recording" && rec.stop();

  return (
    <div className="space-y-2">
      <div className="text-sm">Проверка «живости»: поверни голову влево-вправо</div>
      <video ref={videoRef} playsInline muted className="rounded-xl w-full bg-black/5" />
      <div className="flex items-center gap-2">
        <button onClick={start} disabled={!!rec && rec.state === "recording"} className="px-3 py-2 bg-indigo-600 text-white rounded-lg disabled:bg-slate-300">
          Записать {count ? `(${count})` : ""}
        </button>
        <button onClick={stop} disabled={!rec || rec.state !== "recording"} className="px-3 py-2 bg-slate-200 rounded-lg">
          Стоп
        </button>
        {err && <div className="text-xs text-rose-600">{err}</div>}
      </div>
    </div>
  );
}
