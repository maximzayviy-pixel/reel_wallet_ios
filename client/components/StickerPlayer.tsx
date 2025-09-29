// components/StickerPlayer.tsx — проигрыватель Telegram .tgs (Lottie) с фолбэком на постер
import { useEffect, useRef } from "react";
import lottie, { AnimationItem } from "lottie-web";
import { inflate } from "pako";

type Props = {
  tgsUrl?: string | null;
  poster?: string | null;
  className?: string;
};

export default function StickerPlayer({ tgsUrl, poster, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!tgsUrl || !ref.current) return;

    (async () => {
      try {
        const resp = await fetch(tgsUrl, { cache: "force-cache" });
        const buf = await resp.arrayBuffer();
        // tgs — это gzipped JSON
        const json = JSON.parse(new TextDecoder().decode(inflate(new Uint8Array(buf))));
        if (cancelled || !ref.current) return;
        animRef.current?.destroy();
        animRef.current = lottie.loadAnimation({
          container: ref.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: json,
        });
      } catch (e) {
        // молча падаем — ниже отрисуется постер
        console.warn("tgs load failed", e);
      }
    })();

    return () => {
      cancelled = true;
      animRef.current?.destroy();
      animRef.current = null;
    };
  }, [tgsUrl]);

  return (
    <div className={className}>
      {/* Канва/контейнер для анимации */}
      <div ref={ref} className="w-full h-full" />
      {/* Фолбэк-постер (покажется, если tgs не загрузился) */}
      {poster ? (
        <img
          src={poster}
          alt=""
          className="w-full h-full object-cover absolute inset-0 pointer-events-none select-none"
          style={{ visibility: tgsUrl ? "hidden" : "visible" }}
        />
      ) : null}
    </div>
  );
}
