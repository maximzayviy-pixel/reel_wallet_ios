// pages/browser.tsx
import Layout from "../components/Layout";
import Link from "next/link";

export default function Browser() {
  return (
    <Layout title="Витрина подарков">
      <div className="max-w-md mx-auto p-4">
        {/* Hero card */}
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          {/* soft gradient background */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(1200px_400px_at_50%_-10%,#e0f2fe_0%,transparent_50%),radial-gradient(800px_300px_at_80%_120%,#ecfccb_0%,transparent_40%)] opacity-60"
          />
          <div className="relative p-6">
            {/* badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-3 py-1 text-xs font-medium">
              <span className="animate-pulse">🚧</span> Раздел в разработке
            </div>

            {/* title */}
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Витрина подарков скоро появится
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Здесь будут коллекции подарков, подборки и персональные предложения.
              Мы уже готовим витрины — как только всё будет готово, раздел
              автоматически появится у вас в приложении.
            </p>

            {/* cute inline illustration */}
            <div className="mt-6 flex items-center justify-center">
              <div className="relative h-36 w-56">
                <svg
                  viewBox="0 0 200 120"
                  className="h-full w-full drop-shadow-sm"
                  role="img"
                  aria-label="Иллюстрация: строим раздел"
                >
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#a7f3d0" />
                    </linearGradient>
                  </defs>
                  <rect x="8" y="20" width="184" height="80" rx="12" fill="url(#g1)" opacity="0.25" />
                  <g>
                    <rect x="26" y="36" width="60" height="12" rx="6" fill="#0ea5e9" opacity="0.7" />
                    <rect x="26" y="54" width="92" height="12" rx="6" fill="#22c55e" opacity="0.7" />
                    <rect x="26" y="72" width="44" height="12" rx="6" fill="#f59e0b" opacity="0.7" />
                    {/* loader */}
                    <circle cx="160" cy="50" r="10" fill="#0ea5e9">
                      <animate attributeName="r" values="8;10;8" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="176" cy="66" r="10" fill="#22c55e">
                      <animate attributeName="r" values="8;10;8" dur="1.6s" begin=".2s" repeatCount="indefinite" />
                    </circle>
                  </g>
                </svg>
              </div>
            </div>

            {/* mini-roadmap */}
            <div className="mt-6 space-y-2">
              <div className="text-xs font-medium text-slate-500">Что готовим:</div>
              <ul className="text-sm text-slate-700 space-y-1">
                <li>• Тематические коллекции и поиск</li>
                <li>• Оплата звёздами ⭐ напрямую из кошелька</li>
                <li>• История и отслеживание подарков</li>
              </ul>
            </div>

            {/* actions */}
            <div className="mt-6 flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50"
              >
                ← На главную
              </Link>
              <Link
                href="/history"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 bg-slate-900 text-white hover:bg-slate-800"
              >
                История
              </Link>
              <Link
                href="/scan"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Сканер QR
              </Link>
            </div>

            {/* note */}
            <p className="mt-4 text-[11px] text-slate-400">
              P.S. Если есть идеи для витрины — напишите в чат поддержки, учтём в приоритете.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
