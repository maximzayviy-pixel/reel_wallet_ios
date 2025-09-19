"use client";
import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function Profile() {
  const [info, setInfo] = useState<any>(null);
  const [status, setStatus] = useState<string| null>(null);

  useEffect(() => {
    const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
    const payload = tgUser ? {
      tg_id: tgUser.id,
      username: tgUser.username,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name
    } : null;
    if (payload) {
      setInfo(payload);
      fetch('/api/auth-upsert', { method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
        .then(r => r.ok ? setStatus('Связано с Telegram') : r.text().then(t => setStatus('Ошибка: ' + t)))
        .catch(e => setStatus('Ошибка: ' + (e?.message || e)));
    } else {
      setStatus('Открой через Telegram Mini App, чтобы связать профиль.');
    }
  }, []);

  return (
    <Layout title="Reel Wallet — Профиль">
      <div className="max-w-md mx-auto px-4 pt-8 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="font-semibold">Telegram</div>
          <div className="text-sm text-slate-600">{status}</div>
          {info && (
            <div className="mt-3 text-sm">
              <div>ID: {info.tg_id}</div>
              <div>Username: @{info.username}</div>
              <div>Имя: {info.first_name} {info.last_name || ''}</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
