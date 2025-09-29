"use client";

import Layout from "../components/Layout";
import { useEffect, useState } from "react";

/**
 * Banned page displays the reason why a user has been banned and allows
 * the user to submit an appeal. It fetches user information via
 * `/api/user-info` using the Telegram user id. If the user is not banned,
 * nothing is displayed.
 */
export default function Banned() {
  const [info, setInfo] = useState<any | null>(null);
  const [appeal, setAppeal] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  // Determine Telegram user id using WebApp
  useEffect(() => {
    const tg: any = (window as any)?.Telegram?.WebApp;
    const tg_id = tg?.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    fetch(`/api/user-info?tg_id=${tg_id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) setInfo(j.info);
      })
      .catch(() => {});
  }, []);

  const submitAppeal = async () => {
    if (!appeal.trim() || !info) return;
    setStatus(null);
    try {
      const res = await fetch('/api/appeal-ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tg_id: info.tg_id, appeal }),
      });
      const j = await res.json();
      if (!j?.success) throw new Error(j?.error || 'Ошибка');
      setStatus('Апелляция отправлена');
      setAppeal('');
    } catch (e: any) {
      setStatus(e?.message || 'Ошибка');
    }
  };

  if (!info?.is_banned) {
    return (
      <Layout title="Профиль">
        <div className="p-6 max-w-md mx-auto">
          <div className="text-center text-lg">Вы не заблокированы.</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Блокировка">
      <div className="min-h-[100dvh] bg-rose-50 flex items-center justify-center px-4">
        <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-lg space-y-4">
          <h1 className="text-xl font-bold text-rose-700 text-center">Аккаунт заблокирован</h1>
          <p className="text-sm text-slate-700 text-center">
            Ваш аккаунт был заблокирован. Ниже указана причина. Вы не можете отправить апелляцию.
          </p>
          {info?.ban_reason && (
            <div className="bg-rose-100 text-rose-800 rounded-xl p-3 text-sm">
              <span className="font-semibold">Причина:</span> {info.ban_reason}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs text-slate-500" htmlFor="appeal-input">Апеляция не будет рассмотренна</label>
            <textarea
              id="appeal-input"
              value={appeal}
              onChange={(e) => setAppeal(e.target.value)}
              placeholder="Аккаунт не подлежит разблокировке в сявзи с нарушением пункта 5.3 пользовательского соглашения"
              className="w-full h-24 rounded-xl ring-1 ring-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-slate-300"
            />
            <button
              onClick={submitAppeal}
              disabled={!appeal.trim()}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-4 py-2 text-sm disabled:opacity-60"
            >
              Просим использовать иные кошельки
            </button>
            {status && <div className="text-xs text-center text-emerald-600 mt-2">{status}</div>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
