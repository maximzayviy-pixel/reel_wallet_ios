import React, { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { parseSBPLink, parseEMVQR, EMVParsed } from "../lib/emv";

type ScanResult = {
  raw: string;
  sbpUrl?: string;
  amount?: number; // RUB
  currency?: string;
  merchant?: string;
  city?: string;
  account?: string;
  extra?: Record<string, string>;
};

const ScanPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [status, setStatus] = useState<string>("Наведи камеру на QR");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [torchAvailable, setTorchAvailable] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitResp, setSubmitResp] = useState<any>(null);

  const stopScanner = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {}
    const ms = videoRef.current?.srcObject as MediaStream | undefined;
    ms?.getTracks?.().forEach((t) => t.stop());
  }, []);

  const applyTorch = useCallback(async (on: boolean) => {
    try {
      const track = (videoRef.current?.srcObject as MediaStream)
        ?.getVideoTracks?.()[0];
      const capabilities: any = track?.getCapabilities?.();
      if (capabilities?.torch) {
        await track!.applyConstraints({ advanced: [{ torch: on }] });
        setTorchOn(on);
      }
    } catch {
      // ignore
    }
  }, []);

  const detectTorchSupport = useCallback(() => {
    try {
      const track = (videoRef.current?.srcObject as MediaStream)
        ?.getVideoTracks?.()[0];
      const capabilities: any = track?.getCapabilities?.();
      setTorchAvailable(!!capabilities?.torch);
    } catch {
      setTorchAvailable(false);
    }
  }, []);

  const processRaw = useCallback((raw: string) => {
    const base: ScanResult = { raw };
    // 1) NSPK URL tolerant parse
    const sbp = parseSBPLink(raw);
    if (sbp) {
      base.sbpUrl = sbp.raw;
      base.currency = sbp.currency || base.currency;
      if (typeof sbp.amount === "number") base.amount = sbp.amount;
    }

    // 2) EMV parse (fills amount/merchant/city/etc.)
    const emv: EMVParsed | null = parseEMVQR(raw);
    if (emv) {
      base.merchant = emv.merchant || base.merchant;
      base.city = emv.city || base.city;
      base.account = emv.account || base.account;
      base.currency = emv.currency || base.currency || "RUB";
      if (typeof base.amount !== "number" && typeof emv.amount === "number") {
        base.amount = emv.amount;
      }
      base.extra = emv.additional;
    }

    setStatus("QR распознан");
    setResult(base);
  }, []);

  const tryBarcodeDetectorFallback = useCallback(async () => {
    try {
      // @ts-ignore
      if (!window.BarcodeDetector) return false;
      // @ts-ignore
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const v = videoRef.current!;
      if (!v.videoWidth || !v.videoHeight) return false;

      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(v, 0, 0);
      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), "image/png")
      );
      if (!blob) return false;
      const bmp = await createImageBitmap(blob);
      const det = await detector.detect(bmp);
      if (det?.[0]?.rawValue) {
        stopScanner();
        processRaw(det[0].rawValue);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [processRaw, stopScanner]);

  useEffect(() => {
    let disposed = false;

    (async () => {
      if (!videoRef.current) return;

      try {
        // Prepare stream first so we can control capabilities (torch/focus)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            // browsers can ignore these but no harm in asking
            focusMode: "continuous" as any,
            zoom: true as any,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            advanced: [{ torch: false } as any],
          },
          audio: false,
        });
        if (disposed) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});

        detectTorchSupport();

        // ZXing with hints (QR only + TRY_HARDER)
        const hints = new Map();
        hints.set(DecodeHintType.TRY_HARDER, true);
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
        const reader = new BrowserMultiFormatReader(hints);

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          async (res, err, controls) => {
            if (disposed) return;
            if (res?.getText()) {
              controls.stop();
              controlsRef.current = controls;
              const raw = res.getText();
              stopScanner();
              processRaw(raw);
              return;
            }
            // Fallback: some devices decode better via native API
            if (!res && err) {
              // try BarCodeDetector opportunistically (not every frame)
              await tryBarcodeDetectorFallback();
            }
          }
        );
        controlsRef.current = controls;
        setStatus("Сканирование…");
      } catch (e) {
        console.error(e);
        setError("Не удалось получить доступ к камере. Проверь разрешения.");
        setStatus("Ошибка");
      }
    })();

    return () => {
      disposed = true;
      stopScanner();
    };
  }, [detectTorchSupport, processRaw, stopScanner, tryBarcodeDetectorFallback]);

  // ---- helpers for submit ----
  const snapshotDataUrl = async (): Promise<string | null> => {
    try {
      const v = videoRef.current!;
      if (!v || !v.videoWidth || !v.videoHeight) return null;
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(v, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.9);
    } catch {
      return null;
    }
  };

  const submitToServer = async () => {
    if (!result) return;
    setSubmitting(true);
    setSubmitResp(null);
    try {
      const img = await snapshotDataUrl();
      // tg_id возьми откуда тебе нужно; здесь — пример.
      const tg_id = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id || "debug-user";

      const resp = await fetch("/api/scan-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tg_id,
          qr_payload: result.raw,
          amount_rub: typeof result.amount === "number" ? result.amount : 0,
          qr_image_b64: img || undefined,
        }),
      });

      const j = await resp.json().catch(() => ({}));
      setSubmitResp(j);
      if (!resp.ok || j?.ok === false) {
        setError(`Сервер вернул ошибку: ${j?.error || j?.reason || resp.status}`);
      } else {
        setError("");
      }
    } catch (e: any) {
      setError(`Не удалось отправить: ${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h1>Сканирование СБП-QR</h1>

      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
        <video
          ref={videoRef}
          style={{ width: "100%", maxWidth: 600, background: "#000" }}
          playsInline
          muted
        />
        {torchAvailable && (
          <button
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: torchOn ? "#ffd54f" : "#eeeeee",
              cursor: "pointer",
            }}
            onClick={() => applyTorch(!torchOn)}
          >
            {torchOn ? "Фонарик: Вкл" : "Фонарик: Выкл"}
          </button>
        )}
      </div>

      <p style={{ marginTop: 10, color: "#666" }}>{status}</p>
      {error && (
        <p style={{ color: "#c00", whiteSpace: "pre-wrap" }}>
          {error}
        </p>
      )}

      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #eee",
            borderRadius: 12,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Результат</h3>
          {result.sbpUrl && (
            <p>
              NSPK URL: <code>{result.sbpUrl}</code>
            </p>
          )}
          <p>Сумма: {typeof result.amount === "number" ? `${result.amount.toFixed(2)} RUB` : "—"}</p>
          <p>Мерчант: {result.merchant || "—"}</p>
          <p>Город: {result.city || "—"}</p>
          <p>Счёт/идентификатор: {result.account || "—"}</p>
          {result.extra && Object.keys(result.extra).length > 0 && (
            <>
              <h4>Доп. поля</h4>
              <ul>
                {Object.entries(result.extra).map(([k, v]) => (
                  <li key={k}>
                    <strong>{k}:</strong> {v}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={submitToServer}
              disabled={submitting}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: "#4caf50",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {submitting ? "Отправляю…" : "Отправить в оплату"}
            </button>
            <button
              onClick={() => {
                setResult(null);
                setSubmitResp(null);
                setStatus("Наведи камеру на QR");
                setError("");
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Сканировать ещё
            </button>
          </div>

          {submitResp && (
            <pre
              style={{
                marginTop: 12,
                padding: 12,
                background: "#f9f9f9",
                borderRadius: 8,
                overflow: "auto",
              }}
            >
{JSON.stringify(submitResp, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default ScanPage;
