// client/pages/kyc.tsx
"use client";
import Layout from "../components/Layout";
import useBanRedirect from "../lib/useBanRedirect";
import { useState } from "react";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const contentType = /data:(.*?);/.exec(header)?.[1] || "image/jpeg";
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

async function uploadToUploadcare(file: Blob | string): Promise<string> {
  const pub = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY;
  if (!pub) throw new Error("Uploadcare public key is missing (NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY)");

  const form = new FormData();
  form.append("UPLOADCARE_PUB_KEY", pub);
  form.append("UPLOADCARE_STORE", "1");

  let endpoint = "https://upload.uploadcare.com/base/";
  if (typeof file === "string") {
    endpoint = "https://upload.uploadcare.com/base64/";
    const idx = file.indexOf(",");
    const payload = idx >= 0 ? file.slice(idx + 1) : file;
    form.append("file", payload);
  } else {
    form.append("file", file, "kyc.jpg");
  }

  const res = await fetch(endpoint, { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok || !json?.file) throw new Error(json?.error || "Uploadcare error");
  return `https://ucarecdn.com/${json.file}/`;
}

export default function KYC() {
  useBanRedirect();

  const [faceDataUrl, setFaceDataUrl] = useState<string | null>(null);
  const [docDataUrl, setDocDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ok:boolean; msg:string} | null>(null);

  const onFile = (setter: (v:string)=>void) => (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!faceDataUrl || !docDataUrl) return;
    setSubmitting(true);
    setResult(null);
    try {
      const face_url = await uploadToUploadcare(dataUrlToBlob(faceDataUrl));
      const doc_url = await uploadToUploadcare(dataUrlToBlob(docDataUrl));
      const r = await fetch("/api/kyc-submit", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ face_url, doc_url })
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Не удалось отправить заявку");
      setResult({ ok:true, msg:"Заявка на верификацию отправлена. Ожидайте решения админа." });
      setFaceDataUrl(null); setDocDataUrl(null);
    } catch (e:any) {
      setResult({ ok:false, msg: e.message || "Ошибка отправки" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="KYC">
      <div className="max-w-md mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Верификация личности (KYC)</h1>
        <div className="space-y-3">
          <label className="block">
            <div className="text-sm mb-1">Фото лица</div>
            <input type="file" accept="image/*" onChange={onFile(v=>setFaceDataUrl(v))}/>
          </label>
          {faceDataUrl && <img src={faceDataUrl} alt="face" className="w-full rounded-xl" />}

          <label className="block">
            <div className="text-sm mb-1">Фото документа (паспорт/ID)</div>
            <input type="file" accept="image/*" onChange={onFile(v=>setDocDataUrl(v))}/>
          </label>
          {docDataUrl && <img src={docDataUrl} alt="doc" className="w-full rounded-xl" />}

          <button
            disabled={!faceDataUrl || !docDataUrl || submitting}
            onClick={submit}
            className="w-full rounded-xl bg-indigo-600 disabled:bg-slate-300 text-white py-2"
          >
            Отправить на проверку
          </button>

          {result && (
            <div className={`text-sm ${result.ok ? "text-green-700" : "text-red-600"}`}>
              {result.msg}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
