// components/StickerPlayer.tsx
import { useEffect, useRef, useState } from "react";
import lottie, { AnimationItem } from "lottie-web";

type Props = {
  tgsUrl?: string | null;
  poster?: string | null;
  className?: string; // просто размеры, НЕ absolute!
};

export default function StickerPlayer({ tgsUrl, poster, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [ready, setReady] = useState(false); // true когда лотти реально отрисовался

  useEffect(() => {
    let stopped = false;
    setReady(false);
    animRef.current?.destroy();
    animRef.current = null;

    if (!tgsUrl || !wrapRef.current) return;

    (async () => {
      try {
        const resp = await fetch(`/api/gifts/tgs?u=${encodeURIComponent(tgsUrl)}`, {
          cache: "force-cache",
        });
        if (!resp.ok) throw new Error("tgs fetch failed");
        const data = await resp.json();
        if (stopped || !wrapRef.current) return;

        animRef.current = lottie.loadAnimation({
          container: wrapRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: data,
        });
        animRef.current.addEventListener("DOMLoaded", () => !stopped && setReady(true));
        animRef.current.addEventListener("data_failed", () => !stopped && setReady(false));
      } catch {
        if (!stopped) setReady(false);
      }
    })();

    return () => {
      stopped = true;
      animRef.current?.destroy();
      animRef.current = null;
    };
  }, [tgsUrl]);

  return (
    <div className={`relative ${className || ""}`}>
      {/* Постер — всегда под анимацией, плавно гасим когда лотти загрузился */}
      {poster && (
        <img
          src={poster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover rounded-2xl select-none pointer-events-none"
          style={{ opacity: ready ? 0 : 1, transition: "opacity .25s" }}
          onError={() => setReady(false)}
        />
      )}
      {/* Контейнер лотти */}
      <div ref={wrapRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
