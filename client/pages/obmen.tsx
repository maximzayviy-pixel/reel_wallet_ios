// pages/exchange.tsx
import Layout from "../components/Layout";

export default function Exchange() {
  return (
    <Layout title="Обмен">
      <div className="relative min-h-screen">
        {/* Fullscreen gradient background */}
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          {/* base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#e0f2fe] via-[#fef3c7] to-[#ecfccb]" />
          {/* radial accents */}
          <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_0%_0%,rgba(59,130,246,0.25)_0%,transparent_60%),radial-gradient(1000px_600px_at_100%_100%,rgba(16,185,129,0.25)_0%,transparent_60%)]" />
          {/* soft orbs */}
          <div className="absolute -top-24 left-1/4 h-[28rem] w-[28rem] rounded-full bg-white/30 blur-3xl" />
          <div className="absolute -bottom-24 right-1/5 h-[26rem] w-[26rem] rounded-full bg-white/20 blur-3xl" />
          {/* subtle grid */}
          <div className="absolute inset-0 opacity-[0.15] [background-image:linear-gradient(0deg,rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:40px_40px]" />
          {/* sparkles */}
          <div className="pointer-events-none absolute inset-0 select-none">
            <span className="absolute left-[12%] top-[22%] text-2xl opacity-40">✨</span>
            <span className="absolute left-[78%] top-[18%] text-xl opacity-40">⭐</span>
            <span className="absolute left-[22%] top-[72%] text-xl opacity-30">✴️</span>
            <span className="absolute left-[70%] top-[68%] text-2xl opacity-30">✨</span>
          </div>
        </div>

        {/* Content */}
        <div className="relative flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white/60 backdrop-blur-xl p-8 sm:p-12 ring-1 ring-white/50 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)]">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-100/90 flex items-center justify-center text-2xl shadow-inner">🚧</div>
            <h1 className="mt-5 text-3xl sm:text-4xl font-semibold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
              Раздел в разработке
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-7 text-slate-700">
              Мы бережно готовим этот раздел. Совсем скоро здесь появится красивый и удобный обмен ⭐ звёзд и подарков.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm">
              ✨ Обновление скоро
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
    </Layout>
  );
}
