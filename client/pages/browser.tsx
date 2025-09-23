// pages/browser.tsx
import Layout from "../components/Layout";

export default function Browser() {
  const goToProfile = () => {
    // Замените на реальный роут/действие открытия профиля пользователя
    window.location.href = "/profile";
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
            <div className="absolute -top-8 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-sky-100 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-72 w-72 rounded-full bg-emerald-100 blur-3xl" />
          </div>

          <div className="relative p-6 sm:p-10">
            {/* Header */}
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">🎁</span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                  Отправка коллекционного подарка
                </h1>
                <p className="text-slate-600 text-sm sm:text-base">
                  После передачи подарка ⭐ звёзды начисляются <span className="font-medium text-slate-900">автоматически</span> на ваш баланс.
                </p>
              </div>
            </div>

            {/* Friendly CTA */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={goToProfile}
                className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Зайти в профиль пользователя
                <svg className="ml-2 h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path d="M5 10a1 1 0 0 1 1-1h6.586L10.293 6.707a1 1 0 1 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4A1 1 0 1 1 10.293 13.293L12.586 11H6a1 1 0 0 1-1-1Z" />
                </svg>
              </button>

              <a
                href="https://t.me/ReelWalet"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Нужна помощь? Написать администратору
              </a>
            </div>

            {/* Compensation banner */}
            <div className="mt-6 rounded-2xl ring-1 ring-emerald-200 bg-gradient-to-br from-emerald-50 to-sky-50 p-4">
              <div className="flex items-start gap-3">
                <span>✅</span>
                <div className="text-sm text-slate-700 leading-6">
                  Передача подарка оплачивается <span className="font-medium">25 звёздами</span>. Эти звёзды автоматически <span className="font-medium">компенсируются</span> на баланс после успешной передачи.
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="mt-8 grid gap-4">
              <div className="rounded-2xl ring-1 ring-slate-200 bg-white/70 p-4">
                <div className="text-xs font-medium text-slate-500">Пошаговая инструкция</div>
                <ol className="mt-3 grid gap-3">
                  {[
                    { n: 1, title: "Зайдите в профиль пользователя", desc: "Откройте профиль того, кому хотите отправить подарок." },
                    { n: 2, title: "Откройте меню (⋮)", desc: "Нажмите на три точки в правом верхнем углу профиля." },
                    { n: 3, title: "Выберите «Отправить подарок»", desc: "Откроется витрина доступных коллекционных подарков." },
                    { n: 4, title: "Выберите подарок", desc: "Просмотрите описание и условия — затем продолжайте к оплате." },
                    { n: 5, title: "Оплатите 25 звёзд", desc: "Сумма нужна для передачи и будет компенсирована автоматически." },
                    { n: 6, title: "Нажмите «Передать»", desc: "Подарок уйдёт получателю, а звёзды начислятся на ваш баланс автоматически." },
                  ].map((s) => (
                    <li key={s.n} className="flex gap-3">
                      <div className="flex-none mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-semibold">
                        {s.n}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{s.title}</div>
                        <div className="text-sm text-slate-600">{s.desc}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Video guide */}
              <div className="rounded-2xl ring-1 ring-slate-200 bg-white/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-slate-500">Видео-инструкция</div>
                  <a
                    href="https://telegram.org/file/400780400469/1/WBseEVs-P7s.4554476.mp4/ec249a3bdd29d328b9"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-500 underline decoration-slate-300 hover:decoration-slate-500"
                  >
                    Открыть в новом окне
                  </a>
                </div>
                <div className="mt-3 overflow-hidden rounded-xl bg-black/5\">
                  <video
                    className="w-full h-auto"
                    autoPlay
                    muted
                    loop
                    playsInline
                  >
                    <source src="https://telegram.org/file/400780400469/1/WBseEVs-P7s.4554476.mp4/ec249a3bdd29d328b9" type="video/mp4" />
                    Ваш браузер не поддерживает воспроизведение видео. Вы можете
                    <a href="https://telegram.org/file/400780400469/1/WBseEVs-P7s.4554476.mp4/ec249a3bdd29d328b9" target="_blank" rel="noopener noreferrer">посмотреть ролик здесь</a>.
                  </video>
                </div>
                <p className="mt-2 text-xs text-slate-500">В ролике показано: вход в профиль, меню «⋮», выбор «Отправить подарок», выбор подарка, оплата 25⭐ и подтверждение передачи.</p>
              </div>

              {/* Tips */}
              <div className="rounded-2xl ring-1 ring-slate-200 bg-white/70 p-4">
                <div className="text-xs font-medium text-slate-500">Подсказки</div>
                <ul className="mt-2 space-y-2 text-slate-700 text-sm leading-6">
                  <li>• Если кнопка не видна — обновите приложение и попробуйте снова.</li>
                  <li>• Проверьте, чтобы на кошельке было не менее 25 ⭐ для старта передачи.</li>
                  <li>• Вознаграждение и компенсация начисляются автоматически — обычно в течение пары минут.</li>
                </ul>
              </div>
            </div>

            {/* Footer note */}
            <p className="mt-8 text-[11px] text-slate-400 text-center">
              Есть идеи, как сделать процесс ещё удобнее? Напишите нам — мы прислушаемся.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
