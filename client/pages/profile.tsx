"use client";
import Skeleton from '../components/Skeleton';
import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function Profile() {
  const [info, setInfo] = useState<any>(null);
  const [status, setStatus] = useState<string| null>('Открой через Telegram Mini App, чтобы связать профиль.');

  useEffect(() => {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      try {
        const tg = (window as any)?.Telegram?.WebApp;
        const u = tg?.initDataUnsafe?.user;
        if (u?.id) {
          clearInterval(t);
          setInfo(u);
          setStatus('Связано с Telegram');
          fetch('/api/auth-upsert', { method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({
            tg_id: u.id, username: u.username, first_name: u.first_name, last_name: u.last_name
          })}).catch(()=>{});
        } else if (tries > 40) { // ~4s
          clearInterval(t);
        }
      } catch {}
    }, 100);
    return () => clearInterval(t);
  }, []);

  return (
    <Layout title="Reel Wallet — Профиль">
      <div className="max-w-md mx-auto px-4 pt-8 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="font-semibold">Telegram</div>
          <div className="text-sm text-slate-600">{!info? <Skeleton className='h-5 w-40'/> : status}</div>
          {info && (
            <div className="mt-3 text-sm">
              <div>ID: {info.id}</div>
              <div>Username: @{info.username}</div>
              <div>Имя: {info.first_name} {info.last_name || ''}</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
