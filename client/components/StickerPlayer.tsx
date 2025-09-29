// components/StickerPlayer.tsx — render Telegram .tgs (Lottie) stickers
import { useEffect, useRef } from "react";
import lottie, { AnimationItem } from "lottie-web";
import { inflate } from "pako";

type Props = {
  tgsUrl: string;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  poster?: string | null;
};

export default function StickerPlayer({
  tgsUrl,
  className,
  loop = true,
  autoplay = true,
  poster,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    let aborted = false;

    async function load() {
      try {
        const res = await fetch(tgsUrl);
        const buf = new Uint8Array(await res.arrayBuffer());
        const json = JSON.parse(new TextDecoder().decode(inflate(buf)));

        if (aborted || !ref.current) return;

        // optional faded poster under animation
        if (poster && ref.current) {
          const img = new Image();
          img.src = poster;
          img.className = "w-full h-full object-cover absolute inset-0";
          img.style.opacity = "0.25";
          ref.current.appendChild(img);
        }

        animRef.current = lottie.loadAnimation({
          container: ref.current!,
          renderer: "svg",
          loop,
          autoplay,
          animationData: json,
        });
      } catch (e) {
        // silent
        console.error("StickerPlayer load error", e);
      }
    }

    load();
    return () => {
      aborted = true;
      animRef.current?.destroy();
    };
  }, [tgsUrl, loop, autoplay, poster]);

  return <div ref={ref} className={className} />;
}
