"use client";
import { useEffect, useRef, useState } from "react";

export default function CameraShot({
  label,
  onCapture,
  facingMode = "user", // "user" для селфи, "environment" для документа
  width = 320,
  height = 240,
}: {
  label: string;
  onCapture: (dataUrl: string) => void;
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e: any) {
        setErr(e?.message || "Не удалось открыть камеру");
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  const snap = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, width, height);
    const dataUrl = c.toDataURL("image/jpeg", 0.9);
    onCapture(dataUrl);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm">{label}</div>
      <div className="relative w-full">
        <video ref={videoRef} playsInline muted className="rounded-xl w-full bg-black/5" />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={snap}
          disabled={!ready}
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:bg-slate-300"
        >
          Сфотографировать
        </button>
        {err && <div className="text-xs text-rose-600">{err}</div>}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
