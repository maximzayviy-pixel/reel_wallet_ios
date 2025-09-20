import Layout from "../components/Layout";
import Preloader from "../components/Preloader";
import { useEffect, useState } from "react";
export default function Profile() {
  const [info, setInfo] = useState<any>(null);
  const [status, setStatus] = useState<string| null>('Открой через Telegram Mini App, чтобы связать профиль.');
  const [promo, setPromo] = useState("");
  const [loading, setLoading] = useState(true);
  const redeem = async ()=>{
    if(!promo) return;
    const tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const res = await fetch('/api/promocode-redeem',{ method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ tg_id: tgId, code: promo }) });
    const j = await res.json();
    if(j.ok){ alert('Промокод активирован'); setPromo(""); } else alert(j.error || 'Ошибка');
  };
  useEffect(() => {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      try {
        const tg = (window as any)?.Telegram?.WebApp;
        const u = tg?.initDataUnsafe?.user;
        if (u?.id) {
          clearInterval(t);
          setInfo(u); setStatus('Связано с Telegram');
          fetch('/api/auth-upsert', { method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({
            tg_id: u.id, username: u.username, first_name: u.first_name, last_name: u.last_name
          })}).catch(()=>{});
          setLoading(false);
        } else if (tries > 40) { clearInterval(t); setLoading(false); }
      } catch {}
    }, 100);
    return () => clearInterval(t);
  }, []);
  if (loading) return <Preloader fullscreen />;
  return (<Layout title="Reel Wallet — Профиль">
    <div className="max-w-md mx-auto px-4 pt-8 space-y-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-3">
        <div className="relative">{info?.photo_url ? (
          <img src={info.photo_url} className="w-16 h-16 rounded-full object-cover" />) :
          (<div className="w-16 h-16 rounded-full bg-slate-200" />)}</div>
        <div className="flex-1">
          <div className="font-semibold text-lg flex items-center gap-2">
            {info?.first_name || 'Гость'}
            {info?.is_verified ? <span className="text-blue-600 text-xs bg-blue-50 px-2 py-0.5 rounded-full">✔︎ verified</span> : null}
          </div>
          <div className="text-sm text-slate-500">{status}</div>
          {info?.username ? <div className="text-xs text-slate-400">@{info.username}</div> : null}
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="font-semibold mb-2">Промокод</div>
        <div className="flex gap-2">
          <input value={promo} onChange={(e)=>setPromo(e.target.value)} placeholder="Введите промокод" className="border rounded-xl flex-1 px-3 py-2" />
          <button onClick={redeem} className="bg-slate-900 text-white rounded-xl px-4 py-2">Активировать</button>
        </div>
      </div>
    </div>
  </Layout>);
}