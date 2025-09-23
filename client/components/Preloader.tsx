import { useEffect, useState } from "react";

export default function Preloader() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={"fixed inset-0 z-[9999] flex items-center justify-center bg-black " + (done ? "opacity-0 pointer-events-none transition-opacity duration-500" : "")}>
      <div className="relative">
        <div className="text-5xl md:text-7xl font-extrabold tracking-widest text-transparent bg-clip-text animate-reel-shimmer bg-[linear-gradient(110deg,#888,35%,#fff,65%,#888)] bg-[length:200%_100%]">
          REEL
        </div>
        <div className="absolute inset-0 blur-2xl opacity-30 animate-pulse">
          <div className="w-40 h-40 rounded-full bg-white/10 mx-auto" />
        </div>
      </div>
    </div>
  );
}
