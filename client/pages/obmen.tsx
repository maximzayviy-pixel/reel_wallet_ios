import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";

// --- Optional: shadcn/ui components (fallback to divs if not available) ---
// If you don't use shadcn, the styles still look great with plain divs.
// import { Card, CardContent } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";

export default function Obmen() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Roadmap data — extracted for clarity
  const roadmap = useMemo(
    () => [
      { title: "Обмен на TON", p: 78 },
      { title: "Обмен на другие криптовалюты", p: 56 },
      { title: "Обмен на рубли (обратный)", p: 42 },
    ],
    []
  );

  return (
    <Layout title="Обмен">
      {/* Fullscreen gradient canvas */}
      <div className="relative min-h-[100dvh] overflow-hidden bg-[#0B1220] text-slate-100">
        {/* Gradient mesh & glow orbs */}
        <BackgroundDecor mounted={mounted} />

        {/* Content */}
        <main className="relative z-10 flex min-h-[100dvh] items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-[820px]">
            {/* Header card */}
            <motion.section
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative rounded-3xl p-[1px] bg-gradient-to-br from-sky-400/60 via-blue-500/30 to-cyan-300/60 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.45)]"
            >
              <div className="relative rounded-3xl bg-white/10 backdrop-blur-xl p-6 sm:p-10 ring-1 ring-white/20">
                {/* Shine border */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-px rounded-3xl [mask-image:radial-gradient(300px_300px_at_20%_10%,black,transparent)]"
                  style={{
                    background:
                      "conic-gradient(from 180deg at 50% 50%, rgba(56,189,248,.15), rgba(59,130,246,.15), rgba(191,219,254,.15), rgba(56,189,248,.15))",
                  }}
                />

                <div className="flex items-start gap-3">
                  <div className="mx-auto h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-sky-200/70 to-cyan-300/70 text-xl grid place-items-center text-slate-900 shadow-inner">
                    🚀
                  </div>
                  <div className="grow">
                    <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
                      Обмен скоро станет доступен
                    </h1>
                    <p className="mt-2 text-[15px] leading-7 text-slate-200/90">
                      Мы бережно готовим раздел для красивого и удобного обмена ⭐ звёзд и подарков. Следите за обновлениями —
                      всё будет прозрачно, быстро и приятно.
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-2 text-xs font-medium text-white ring-1 ring-white/10">
                        ✨ Обновление скоро
                      </span>
                      <a
                        href="https://t.me/ReelWalet"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:opacity-90 transition"
                      >
                        Связаться с администратором
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="opacity-90">
                          <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>

                {/* subtle divider */}
                <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                {/* Roadmap */}
                <div className="mt-6">
                  <div className="text-xs font-medium text-slate-300/80">Дорожная карта</div>
                  <ul className="mt-3 grid gap-3">
                    {roadmap.map((it, i) => (
                      <motion.li
                        key={it.title}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * i, duration: 0.4 }}
                        className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4"
                      >
                        <div className="flex items-center justify-between text-sm text-slate-200">
                          <span className="font-medium text-slate-100">{it.title}</span>
                          <span className="font-semibold text-sky-200">{it.p}%</span>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-slate-200/20 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-sky-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${it.p}%` }}
                            transition={{ duration: 0.9, ease: "easeOut", delay: 0.05 * i }}
                          />
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Footer note */}
                <p className="mt-6 text-xs text-slate-300/80">
                  Есть идеи или предложения? Напишите администратору
                  {" "}
                  <a
                    href="https://t.me/ReelWalet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-slate-300/40 hover:decoration-slate-200"
                  >
                    @ReelWalet
                  </a>
                </p>
              </div>
            </motion.section>

            {/* Secondary info tiles */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: "Безопасность",
                  desc: "Шифрование и проверка операций",
                  icon: "🔐",
                },
                {
                  title: "Скорость",
                  desc: "Мгновенные транзакции",
                  icon: "⚡",
                },
                {
                  title: "Прозрачность",
                  desc: "Простые комиссии и статусы",
                  icon: "🔎",
                },
              ].map((f, idx) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.45, delay: 0.05 * idx }}
                  className="group relative overflow-hidden rounded-2xl ring-1 ring-white/10 bg-white/5 backdrop-blur-xl p-4"
                >
                  <div className="absolute -inset-0.5 opacity-0 group-hover:opacity-100 transition pointer-events-none [mask-image:radial-gradient(160px_160px_at_var(--x,50%)_var(--y,50%),white,transparent)]" style={{ background: "radial-gradient(300px 200px at 0% 0%, rgba(56,189,248,.2), transparent 60%), radial-gradient(300px 200px at 100% 100%, rgba(59,130,246,.2), transparent 60%)" }} />
                  <div className="relative">
                    <div className="h-10 w-10 rounded-2xl bg-white/10 grid place-items-center text-xl">{f.icon}</div>
                    <h3 className="mt-3 font-semibold text-slate-100">{f.title}</h3>
                    <p className="mt-1 text-sm text-slate-300/90">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
}

function BackgroundDecor({ mounted }: { mounted: boolean }) {
  return (
    <>
      {/* Soft gradients */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_0%_0%,rgba(59,130,246,0.20)_0%,transparent_60%),radial-gradient(1000px_600px_at_100%_100%,rgba(2,132,199,0.18)_0%,transparent_60%)]" />
        <div className="absolute -top-24 left-1/4 h-[28rem] w-[28rem] rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute -bottom-24 right-1/5 h-[26rem] w-[26rem] rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(0deg,rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      {/* Animated particles */}
      <AnimatePresence>
        {mounted &&
          Array.from({ length: 18 }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0], y: [0, -40, 0] }}
              transition={{ duration: 3 + (i % 5), repeat: Infinity, delay: i * 0.15 }}
              className="pointer-events-none absolute top-1/2 left-1/2 h-[2px] w-[70px] -translate-x-1/2 -translate-y-1/2 rotate-[--r] bg-gradient-to-r from-transparent via-white/70 to-transparent"
              style={{
                // slight different angles for each particle
                // @ts-ignore
                "--r": `${(i * 20) % 360}deg`,
              }}
            />
          ))}
      </AnimatePresence>

      {/* Top overlay gloss */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent"
      />
    </>
  );
}
