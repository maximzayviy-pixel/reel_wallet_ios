"use client";
import { useEffect, useState } from "react";

export default function AdminGuard({ children }:{ children: React.ReactNode }) {
  const [ok, setOk] = useState<null | boolean>(null);

  useEffect(() => {
    fetch("/api/admin/session", { credentials: "include" })
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then(() => setOk(true))
      .catch(() => setOk(false));
  }, []);

  if (ok === null) return <div className="p-6 text-sm text-slate-500">Проверка доступа…</div>;
  if (!ok) return <div className="p-6 text-center">
    <div className="mx-auto max-w-md rounded-2xl p-6 bg-white shadow ring-1 ring-slate-200">
      <div className="text-2xl font-semibold">Доступ запрещён</div>
      <div className="mt-2 text-slate-600">Открой через Telegram Mini App под админом.</div>
    </div>
  </div>;
  return <>{children}</>;
}
