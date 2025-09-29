// components/StickerPlayer.tsx — рендер .tgs (Lottie)
import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";

type Props = {
  tgsUrl: string;
  poster?: string;
  className?: string;
};

export default function StickerPlayer({ tgsUrl, poster, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let anim: AnimationItem | null = null;
    let aborted = false;

    (async () => {
      const [{ default: lottie }, { inflate }] = await Promise.all([
        import("lottie-web"),
        import("pako"),
      ]);
      const res = await fetch(tgsUrl);
      const buf = new Uint8Array(await res.arrayBuffer());
      const json = JSON.parse(new TextDecoder().decode(inflate(buf)));

      if (!ref.current || aborted) return;
      anim = lottie.loadAnimation({
        container: ref.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: json,
      });
    })();

    return () => {
      aborted = true;
      try { anim?.destroy(); } catch {}
    };
  }, [tgsUrl]);

  return (
    <div className={className}>
      {poster && (
        <img
          src={poster}
          alt=""
          className="w-full h-full object-cover absolute inset-0 opacity-0"
          aria-hidden
        />
      )}
      <div ref={ref} className="w-full h-full" />
    </div>
  );
}
