'use client';
import React, { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

export default function Page() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [torchOn, setTorchOn] = useState(false);
  const [controls, setControls] = useState<IScannerControls | null>(null);

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    // @ts-ignore (may be unsupported in some builds)
    hints.set(DecodeHintType.ALSO_INVERTED, true);

    const reader = new BrowserQRCodeReader(hints);

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            frameRate: { ideal: 60 },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // If torch state is ON, try to enable it after stream starts.
        try {
          const tracks = (stream.getVideoTracks && stream.getVideoTracks()) || [];
          const track = tracks[0];
          if (track && torchOn) {
            // @ts-ignore - 'advanced.torch' is not in TS lib types
            await track.applyConstraints({ advanced: [{ torch: true }] });
          }
        } catch { /* ignore torch errors */ }

        const c = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (res, err, _controls) => {
            if (_controls && !controls) setControls(_controls);
            if (res) {
              setResult(res.getText());
              setError('');
            }
          }
        );
        setControls(c);
      } catch (e: any) {
        setError(e?.message || 'Cannot start camera');
      }
    }

    start();
    return () => {
      if (controls) controls.stop();
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
      }
    };
  }, [torchOn]);

  const toggleTorch = async () => {
    try {
      const tracks = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks();
      const track = tracks && tracks[0];
      if (!track) return;
      // @ts-ignore - 'advanced.torch' is not in TS lib types
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch { /* ignore if unsupported */ }
  };

  return (
    <main style={{display:'grid', placeItems:'center', gap:16, padding:16, fontFamily:'system-ui'}}>
      <h1>Kozen P12 — QR Scanner</h1>
      <video ref={videoRef} style={{ width:'min(100%, 480px)', borderRadius:12, boxShadow:'0 6px 24px rgba(0,0,0,.15)' }} muted playsInline />
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={toggleTorch} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #ccc' }}>
          {torchOn ? 'Turn torch OFF' : 'Turn torch ON'}
        </button>
      </div>
      {result && (
        <div style={{ maxWidth:600, width:'100%' }}>
          <h3>Decoded:</h3>
          <textarea readOnly value={result} style={{ width:'100%', minHeight:120, padding:8, borderRadius:8 }} />
          <p style={{fontSize:12, opacity:.8}}>Supports EMVCo/NSPK QR (e.g., <code>000201...</code> or <code>https://qr.nspk.ru/...</code>).</p>
        </div>
      )}
      {error && <p style={{ color:'crimson' }}>{error}</p>}
    </main>
  );
}
