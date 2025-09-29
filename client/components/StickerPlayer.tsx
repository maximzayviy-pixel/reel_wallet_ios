// components/StickerPlayer.tsx
import { useEffect, useRef, useState } from "react";
import lottie, { AnimationItem } from "lottie-web";

type Props = {
  tgsUrl?: string | null;
  poster?: string | null;
  className?: string;
};

export default function StickerPlayer({ tgsUrl, poster, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    animRef.current?.destroy();
    animRef.current = null;

    if (!tgsUrl || !wrapRef.current) return;

    (async () => {
      try {
        const proxied = `/api/gifts/tgs?u=${encodeURIComponent(tgsUrl)}`;
        const resp = await fetch(proxied, { cache: "force-cache" });
        if (!resp.ok) throw new Error("tgs fetch failed");
        const data = await resp.json();

        if (cancelled || !wrapRef.current) return;
        animRef.current = lottie.loadAnimation({
          container: wrapRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: data,
        });
        animRef.current.addEventListener("DOMLoaded", () => !cancelled && setLoaded(true));
        animRef.current.addEventListener("data_failed", () => !cancelled && setLoaded(false));
      } catch (e) {
        console.warn("TGS load error:", e);
        if (!cancelled) setLoaded(false);
      }
    })();

    return () => {
      cancelled = true;
      animRef.current?.destroy();
      animRef.current = null;
    };
  }, [tgsUrl]);

  return (
    <div className={`relative ${className || ""}`}>
      {/* Постер под анимацией — виден, пока loaded=false */}
      {poster && (
        <img
          src={poster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover rounded-2xl"
          style={{ opacity: loaded ? 0 : 1, transition: "opacity .25s" }}
        />
      )}
      {/* Контейнер под lottie */}
      <div ref={wrapRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
