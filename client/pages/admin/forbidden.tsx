export default function Forbidden() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="max-w-md mx-auto text-center bg-white p-8 rounded-2xl shadow ring-1 ring-slate-200">
        <div className="text-2xl font-bold">Доступ запрещён</div>
        <p className="mt-3 text-slate-600">
          Админка открывается только из Telegram Mini App. Откройте приложение и зайдите под админом.
        </p>
      </div>
    </div>
  );
}
