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
        // подтянем .tgs и распакуем как lottie json
        const res = await fetch(tgsUrl);
        const buf = await res.arrayBuffer();
        const json = JSON.parse(new TextDecoder().decode(inflate(new Uint8Array(buf))));
        if (aborted || !ref.current) return;

        // фон-постер, пока лоадится
        if (poster && ref.current && !ref.current.firstChild) {
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
      } catch {
        // silent fallback
      }
    }
    load();

    return () => {
      aborted = true;
      animRef.current?.destroy();
    };
  }, [tgsUrl, autoplay, loop, poster]);

  return <div ref={ref} className={className} />;
}
