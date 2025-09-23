// pages/exchange.tsx
import { useEffect, useState } from "react";
import Layout from "../components/Layout";

export default function Exchange() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <Layout title="Обмен">
      {/* Фикс на весь экран без скролла */}
      <div className="relative h-[100dvh] overflow-hidden">
        {/* Fullscreen blue gradient */}
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          {/* base blue-ish gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#e6f0ff] via-[#dbeafe] to-[#e0f2fe]" />
          {/* radial blue accents */}
          <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_0%_0%,rgba(59,130,246,0.28)_0%,transparent_60%),radial-gradient(1000px_600px_at_100%_100%,rgba(2,132,199,0.26)_0%,transparent_60%)]" />
          {/* soft orbs */}
          <div className="absolute -top-24 left-1/4 h-[28rem] w-[28rem] rounded-full bg-white/25 blur-3xl" />
          <div className="absolute -bottom-24 right-1/5 h-[26rem] w-[26rem] rounded-full bg-white/20 blur-3xl" />
          {/* subtle grid */}
          <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(0deg,rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:40px_40px]" />
        </div>

        {/* Content */}
        <div className="relative flex h-[100dvh] items-center justify-center p-4">
          {/* Aura wrapper */}
          <div className="relative w-full max-w-[680px]">
            {/* light aura behind the card */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-0.5 rounded-[34px] blur-2xl opacity-80"
              style={{
                background:
                  "conic-gradient(from 180deg at 50% 50%, rgba(59,130,246,.35), rgba(2,132,199,.35), rgba(191,219,254,.35), rgba(59,130,246,.35))",
              }}
            />

            {/* Card */}
            <div
              className={[
                "relative rounded-[28px] bg-white/70 backdrop-blur-xl p-7 sm:p-10 ring-1 ring-white/50 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)]",
                "transition-all duration-700 ease-out",
                mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-[0.99]",
              ].join(" ")}
            >
              <div className="mx-auto h-12 w-12 rounded-2xl bg-blue-100/90 flex items-center justify-center text-xl shadow-inner">🚧</div>
              <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
                Раздел в разработке
              </h1>
              <p className="mt-2 text-[15px] leading-7 text-slate-700">
                Мы бережно готовим этот раздел. Совсем скоро здесь появится красивый и удобный обмен ⭐ звёзд и подарков.
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm">
                ✨ Обновление скоро
              </div>

              {/* Roadmap */}
              <div className="mt-8">
                <div className="text-xs font-medium text-slate-500">Дорожная карта</div>

                <div className="mt-3 space-y-3">
                  {/* Item */}
                  <div>
                    <div className="flex items-center justify-between text-sm text-slate-700">
                      <span>Обмен на TON</span>
                      <span className="font-medium text-slate-900">70%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500" style={{ width: "70%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm text-slate-700">
                      <span>Обмен на другие криптовалюты</span>
                      <span className="font-medium text-slate-900">50%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500" style={{ width: "50%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm text-slate-700">
                      <span>Обмен на рубли (обратный)</span>
                      <span className="font-medium text-slate-900">40%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500" style={{ width: "40%" }} />
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-6 text-xs text-slate-500">
                Вопросы и идеи — напишите администратору
                {" "}
                <a
                  href="https://t.me/ReelWalet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-slate-300 hover:decoration-slate-500"
                >
                  @ReelWalet
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
