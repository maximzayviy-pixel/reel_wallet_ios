import Skeleton from '../components/Skeleton';
import Layout from "../components/Layout";
import Preloader from "../components/Preloader";
import { useEffect, useState } from "react";
export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [stars, setStars] = useState<number>(0);
  const [ton, setTon] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [checkingSub, setCheckingSub] = useState(true);
  const [subscribed, setSubscribed] = useState(true);
  const tg: any = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;
  useEffect(() => {
    try { const u = tg?.initDataUnsafe?.user; if (u) setUser(u); } catch {}
    const tgId = tg?.initDataUnsafe?.user?.id || (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    (async () => {
      try { const res = await fetch(`/api/health`); if (res.ok) setSubscribed(true); } catch {}
      setCheckingSub(false);
      if (!tgId) { setLoading(false); return; }
      try {
        const res = await fetch(`/api/my-balance?tg_id=${tgId}`);
        const json = await res.json();
        const src = json?.balance ? json.balance : json;
        setStars(Number(src?.stars || 0));
        setTon(Number(src?.ton || 0));
      } catch {}
      setLoading(false);
    })();
  }, []);
  const total = (stars / 2) + (ton * 300);
  if (checkingSub) return <Preloader fullscreen />;
  if (!subscribed) {
    return (<Layout title="Reel Wallet — beta 1.1">
      <div className="max-w-md mx-auto px-4 pt-16 text-center">
        <img src="/update.gif" className="w-28 h-28 mx-auto mb-4" />
        <div className="text-lg font-semibold mb-2">Нужна подписка</div>
        <p className="text-slate-600 mb-4">Подпишись на наш Telegram-канал, чтобы пользоваться кошельком.</p>
        <a href="https://t.me/reelwallet" target="_blank" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-xl">Открыть канал</a>
      </div>
    </Layout>);
  }
  return (
    <Layout title="Reel Wallet — beta 1.1">
      <div className="bg-gradient-to-b from-blue-600 to-blue-500 text-white rounded-b-3xl pb-7 pt-10">
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            {user?.photo_url ? (<img src={user.photo_url} className="w-10 h-10 rounded-full object-cover" />)
            : (<div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">🙂</div>)}
            <div className="text-sm opacity-90">{user?.username ? `@${user.username}` : (user?.first_name || 'Гость')}</div>
            <div className="ml-auto text-xs bg-white/20 rounded-full px-2 py-1 opacity-90">Reel — beta 1.1</div>
          </div>
          <div className="text-sm/5 opacity-90">Общий баланс</div>
          <div className="text-5xl font-bold tracking-tight">
            {loading ? <Skeleton className="h-10 w-32 mt-2" /> : `${total.toFixed(2)} ₽`}
          </div>
          <div className="grid grid-cols-4 gap-3 mt-6">
            {[{ label: "Пополнить", href: "/topup" },
              { label: "Перевести", href: "/transfer", dev:true },
              { label: "Обменять", href: "/exchange", dev:true },
              { label: "Оплатить", href: "/scan" }].map((b, i) => (
              <a key={i} href={b.dev ? "#" : b.href}
                 onClick={(e)=>{ if(b.dev){ e.preventDefault(); alert("🚧 Раздел в разработке"); } }}
                 className="bg-white/10 rounded-2xl py-3 text-center text-xs backdrop-blur block">
                <div className="w-10 h-10 rounded-xl bg-white/20 mx-auto mb-1 flex items-center justify-center">
                  <span className="text-lg">{i===1?"⇄":i===2?"⟲":"💳"}</span>
                </div>
                <div>{b.label}</div>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-md mx-auto px-4 mt-4 space-y-4">
        <a href="https://t.me/reelwallet" target="_blank" rel="noreferrer" className="block rounded-3xl bg-gradient-to-r from-blue-500 to-indigo-600 p-5 text-white">
          <div className="text-lg font-semibold">Подписывайся на наш Telegram-канал</div>
          <div className="text-xs opacity-90 mb-2">@reelwallet</div>
          <span className="bg-white text-slate-900 rounded-full px-3 py-1 text-sm inline-block">Открыть канал</span>
        </a>
        {[{ name: "Звёзды Telegram (⭐)", amount: stars, sub: `${(stars / 2).toFixed(2)} ₽`, icon: "⭐" },
          { name: "TON (🔷)", amount: ton, sub: `${(ton * 300).toFixed(2)} ₽`, icon: "" }].map((a, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">
              {i===1 ? <img src="/ton.png" className="w-5 h-5" /> : a.icon}
            </div>
            <div className="flex-1"><div className="font-semibold">{a.name}</div>
              <div className="text-xs text-slate-500">{a.sub}</div></div>
            <div className="text-right"><div className="font-semibold">{a.amount}</div></div>
          </div>
        ))}
      </div>
    </Layout>
  ); }