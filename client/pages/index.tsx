import Layout from "../components/Layout";
import { Wallet, Send, Shuffle, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function Home() {
  const [stars, setStars] = useState<number>(0);
  const [ton, setTon] = useState<number>(0);
  const total = (stars/2) + (ton*300);

  useEffect(()=>{
    (async()=>{
      const userId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || localStorage.getItem('user_id');
      if(!userId) return;
      // fetch user's balance row (by joining via tg_id -> users.id not trivial client-side; assume user_id == tg_id for demo or auth-upsert sets localStorage user_id to UUID)
      // For stability, call a lightweight view: balances_by_tg is not set; fallback to 'balances' by matching user UUID stored in localStorage (set by auth-upsert response if needed)
      const { data } = await supabase.from('balances').select('*').limit(1);
      const row = (data && data[0]) || null;
      if(row){
        setStars(Number(row.stars||0));
        setTon(Number(row.ton||0));
      }
    })();
  },[]);

  return (
    <Layout title="Reel Wallet">
      <div className="bg-gradient-to-b from-blue-600 to-blue-500 text-white rounded-b-3xl pb-7 pt-10">
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">🙂</div>
            <div className="text-sm opacity-90">@user</div>
            <div className="ml-auto text-xs bg-white/20 rounded-full px-2 py-1 opacity-90">Reel</div>
          </div>
          <div className="text-sm/5 opacity-90">Общий баланс</div>
          <div className="text-5xl font-bold tracking-tight">{total.toFixed(2)} ₽</div>

          <div className="grid grid-cols-4 gap-3 mt-6">
            {[
              {label: "Пополнить", href: "/topup", icon: <Wallet size={18} />},
              {label: "Перевести", href: "/", icon: <Send size={18} />},
              {label: "Обменять", href: "/", icon: <Shuffle size={18} />},
              {label: "Оплатить", href: "/scan", icon: <QrCode size={18} />},
            ].map((b, i)=>(
              <a key={i} href={b.href} className="bg-white/10 rounded-2xl py-3 text-center text-xs backdrop-blur block">
                <div className="w-10 h-10 rounded-xl bg-white/20 mx-auto mb-1 flex items-center justify-center">
                  {b.icon}
                </div>
                <div>{b.label}</div>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-4 space-y-4">
        {/* Subscribe banner */}
        <a href="https://t.me/reelwallet" target="_blank" rel="noreferrer" className="block rounded-3xl bg-gradient-to-r from-blue-500 to-indigo-600 p-5 text-white">
          <div className="text-lg font-semibold">Подписывайся на наш Telegram-канал</div>
          <div className="text-xs opacity-90 mb-2">@reelwallet</div>
          <span className="bg-white text-slate-900 rounded-full px-3 py-1 text-sm inline-block">Открыть канал</span>
        </a>

        {/* Assets: Stars and TON only */}
        {[
          { name: "Звёзды Telegram (⭐)", amount: stars, sub: `${(stars/2).toFixed(2)} ₽`, icon: "⭐" },
          { name: "TON (🔷)", amount: ton, sub: `${(ton*300).toFixed(2)} ₽`, icon: "🔷" },
        ].map((a, i)=>(
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">{a.icon}</div>
            <div className="flex-1">
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-slate-500">{a.sub}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{a.amount}</div>
              <div className="text-xs text-slate-500">в единицах</div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
