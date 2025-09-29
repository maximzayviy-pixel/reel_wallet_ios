"use client";
import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const type = /data:(.*?);/.exec(header)?.[1] || "image/jpeg";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
async function uploadcarePut(file: Blob, filename = "file.bin"): Promise<string> {
  const pub = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY!;
  const form = new FormData();
  form.append("UPLOADCARE_PUB_KEY", pub);
  form.append("UPLOADCARE_STORE", "1");
  form.append("file", file, filename);
  const r = await fetch("https://upload.uploadcare.com/base/", { method: "POST", body: form });
  const j = await r.json();
  return `https://ucarecdn.com/${j.file}/`;
}

export default function KYCPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [face, setFace] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [liveBlob, setLiveBlob] = useState<Blob | null>(null);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const startCamera = async (facing: "user" | "environment") => {
    stream?.getTracks().forEach((t) => t.stop());
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
    setStream(s);
    if (videoRef.current) {
      videoRef.current.srcObject = s;
      await videoRef.current.play();
    }
  };

  const snap = async (target: "face" | "doc") => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = target === "face" ? 480 : 720;
    c.height = 480;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.9);
    if (target === "face") setFace(url);
    if (target === "doc") setDoc(url);
    setStep(target === "face" ? 2 : 3);
  };

  const startLive = async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    setStream(s);
    if (videoRef.current) {
      videoRef.current.srcObject = s;
      await videoRef.current.play();
    }
    const rec = new MediaRecorder(s, { mimeType: "video/webm" });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => e.data && chunks.push(e.data);
    rec.onstop = () => {
      setLiveBlob(new Blob(chunks, { type: "video/webm" }));
      setStep(4);
    };
    rec.start();
    setTimeout(() => rec.stop(), 5000);
  };

  const submit = async () => {
    if (!face || !doc) return;
    const face_url = await uploadcarePut(dataUrlToBlob(face), "face.jpg");
    const doc_url = await uploadcarePut(dataUrlToBlob(doc), "doc.jpg");
    let liveness_url: string | undefined;
    if (liveBlob) liveness_url = await uploadcarePut(liveBlob, "live.webm");

    const tg = (window as any).Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    await fetch(`/api/kyc-submit?tg_id=${user.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ face_url, doc_url, liveness_url }),
    });
    alert("Заявка отправлена, жди подтверждения.");
  };

  return (
    <Layout title="KYC">
      <div className="max-w-md mx-auto p-4 space-y-4">
        {step <= 2 && (
          <div>
            <video ref={videoRef} muted playsInline className={step === 1 ? "w-48 h-48 rounded-full mx-auto" : "w-full rounded-xl"} />
            <div className="mt-4 flex justify-center">
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl"
                onClick={() => {
                  if (step === 1) {
                    startCamera("user");
                    snap("face");
                  } else {
                    startCamera("environment");
                    snap("doc");
                  }
                }}
              >
                {step === 1 ? "Сфотографировать лицо" : "Сфотографировать документ"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <video ref={videoRef} muted playsInline className="w-full rounded-xl" />
            <button onClick={startLive} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl">
              Записать видео (5с)
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <img src={face!} alt="face" className="w-32 h-32 rounded-full mx-auto" />
            <img src={doc!} alt="doc" className="w-full rounded-xl" />
            <button onClick={submit} className="w-full px-4 py-2 bg-emerald-600 text-white rounded-xl">
              Отправить заявку
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
