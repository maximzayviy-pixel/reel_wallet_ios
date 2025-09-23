// pages/exchange.tsx
import Layout from "../components/Layout";

export default function Exchange() {
  return (
    <Layout title="Обмен">
      <div className="min-h-[60vh] grid place-items-center p-4 sm:p-6">
        <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
          {/* мягкие градиенты */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(80%_80%_at_50%_30%,#000_40%,transparent_100%)]"
          >
            <div className="absolute -top-16 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-100 blur-3xl" />
            <div className="absolute -bottom-20 -right-10 h-80 w-80 rounded-full bg-emerald-100 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-rose-100 blur-3xl" />
          </div>

          <div className="relative p-8 sm:p-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl">🚧</div>
            <h1 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Раздел в разработке</h1>
            <p className="mt-2 text-sm sm:text-base leading-6 text-slate-600">
              Мы бережно готовим этот раздел. Скоро здесь появится удобный обмен звёзд и подарков.
              Спасибо за ваше терпение!
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm">
              <span className="animate-pulse">✨</span> Обновление скоро
            </div>

            <p className="mt-6 text-[11px] text-slate-400">
              Вопросы и идеи — пишите администратору:
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
