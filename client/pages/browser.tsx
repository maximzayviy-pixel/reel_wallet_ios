// pages/browser.tsx
import { useState } from "react";
import Layout from "../components/Layout";

export default function Browser() {
  const [copied, setCopied] = useState(false);
  const adminHandle = "@ReelWalet";
  const adminUrl = "https://t.me/ReelWalet";

  const copyHandle = async () => {
    try {
      await navigator.clipboard.writeText(adminHandle);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Layout title="Витрина подарков">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        {/* Card */}
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
          {/* Soft gradients background */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(60%_60%_at_50%_30%,#000_40%,transparent_100%)]"
          >
            <div className="absolute -top-8 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-100 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-72 w-72 rounded-full bg-emerald-100 blur-3xl" />
          </div>

          <div className="relative p-6 sm:p-10">
            {/* Header */}
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100">🎁</span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                  Передача коллекционного подарка
                </h1>
                <p className="text-slate-600 text-sm sm:text-base">
                  Юзеры передают подарок администратору вручную, а админ вручную начисляет ⭐ звёзды на баланс.
                </p>
              </div>
            </div>

            {/* CTA block */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <a
                href={adminUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Связаться с админом в Telegram
                <svg
                  className="ml-2 h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M5 10a1 1 0 0 1 1-1h6.586L10.293 6.707a1 1 0 1 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4A1 1 0 1 1 10.293 13.293L12.586 11H6a1 1 0 0 1-1-1Z" />
                </svg>
              </a>

              <button
                type="button"
                onClick={copyHandle}
                className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50"
              >
                {copied ? "Скопировано!" : `Скопировать ${adminHandle}`}
              </button>
            </div>

            {/* Steps */}
            <div className="mt-8 grid gap-4">
              <div className="rounded-2xl ring-1 ring-slate-200 bg-white/70 p-4">
                <div className="text-xs font-medium text-slate-500">Как это работает</div>
                <ol className="mt-2 space-y-2 text-slate-700 text-sm leading-6">
                  <li className="flex gap-2"><span className="mt-1 text-slate-400">1.</span><span>Напишите админу <a href={adminUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 underline decoration-slate-300 hover:decoration-slate-500">{adminHandle}</a> в Telegram.</span></li>
                  <li className="flex gap-2"><span className="mt-1 text-slate-400">2.</span><span>Передайте коллекционный подарок вручную (по инструкции ниже).</span></li>
                  <li className="flex gap-2"><span className="mt-1 text-slate-400">3.</span><span>Админ проверит передачу и начислит соответствующее количество ⭐ звёзд на ваш баланс.</span></li>
                </ol>
              </div>

              <div className="rounded-2xl ring-1 ring-slate-200 bg-gradient-to-br from-sky-50 to-emerald-50 p-4">
                <div className="text-xs font-medium text-slate-500">Инструкция по передаче подарка админу</div>
                <ul className="mt-2 space-y-2 text-slate-700 text-sm leading-6">
                  <li>• Откройте Telegram и перейдите в профиль администратора: <a href={adminUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 underline decoration-slate-300 hover:decoration-slate-500">{adminHandle}</a>.</li>
                  <li>• Отправьте сообщение с темой подарка и его идентификатором/скриншотом.</li>
                  <li>• Дождитесь подтверждения от админа и следуйте его дальнейшим инструкциям (если понадобятся).</li>
                </ul>
              </div>

              {/* Info / safety */}
              <div className="rounded-2xl ring-1 ring-slate-200 bg-white/70 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5">ℹ️</span>
                  <div className="text-sm text-slate-700 leading-6">
                    Начисление звёзд производится <span className="font-medium text-slate-900">вручную администратором</span> после проверки передачи подарка. Срок — как правило в пределах 24 часов.
                  </div>
                </div>
              </div>

              {/* FAQ / tips */}
              <div className="rounded-2xl ring-1 ring-slate-200 bg-white/70 p-4">
                <div className="text-xs font-medium text-slate-500">Подсказки</div>
                <ul className="mt-2 space-y-2 text-slate-700 text-sm leading-6">
                  <li>• Если профиль не открывается, скопируйте ник и найдите его в поиске Telegram.</li>
                  <li>• Сохраняйте переписку до зачисления звёзд.</li>
                  <li>• По вопросам безопасности — пишите только по ссылке или нику выше.</li>
                </ul>
              </div>
            </div>

            {/* Footer note */}
            <p className="mt-8 text-[11px] text-slate-400 text-center">
              Если возникли сложности с передачей подарка — напишите админу, мы поможем.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
