// client/lib/uploadcare.ts
// Использует твой проектный CDN-хост (пример: https://42vi5iz051.ucarecd.net)

const CDN_BASE =
  (process.env.NEXT_PUBLIC_UPLOADCARE_CDN_BASE ||
    process.env.UPLOADCARE_CDN_BASE ||
    "https://ucarecdn.com").replace(/\/+$/, "");

export function buildCdnUrlFromUuid(uuid: string): string {
  // ожидаем UUID v4 без лишних хвостов
  const clean = (uuid || "").trim().match(/[0-9a-f-]{36}/i)?.[0];
  if (!clean) throw new Error("Bad Uploadcare UUID");
  return `${CDN_BASE}/${clean}/`;
}

export function normalizeUploadcareUrl(anyUrlOrUuid: string): string {
  if (!anyUrlOrUuid) throw new Error("Empty uploadcare url");
  if (/^https?:\/\//i.test(anyUrlOrUuid)) {
    // уже полная ссылка → вернём как есть, только уберём лишние слэши
    return anyUrlOrUuid.replace(/\/+$/, "/");
  }
  return buildCdnUrlFromUuid(anyUrlOrUuid);
}

export async function uploadToUploadcare(
  file: Blob,
  filename = "file.bin"
): Promise<string> {
  const pub = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY;
  if (!pub) throw new Error("Missing NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY");

  const form = new FormData();
  form.append("UPLOADCARE_PUB_KEY", pub);
  form.append("UPLOADCARE_STORE", "1");
  form.append("file", file, filename);

  const r = await fetch("https://upload.uploadcare.com/base/", {
    method: "POST",
    body: form,
  });
  const j = await r.json();
  if (!r.ok || !j?.file) throw new Error(j?.error || "Uploadcare error");

  // ВАЖНО: строим ссылку именно на твой CDN-хост
  return buildCdnUrlFromUuid(String(j.file));
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const type = /data:(.*?);/.exec(header)?.[1] || "image/jpeg";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
