// pages/browser.tsx
import Layout from "../components/Layout";
import { useState, useEffect } from "react";

export default function Browser() {
  const [gifts, setGifts] = useState<any[]>([]);

  useEffect(() => {
    // тут можно грузить список подарков с твоего API
    setGifts([
      { id: 1, name: "💎 Premium Gift", price: 50, desc: "Откроет доступ к фичам" },
      { id: 2, name: "🎁 Random Box", price: 25, desc: "Случайный сюрприз" }
    ]);
  }, []);

  const buy = async (gift:any) => {
    const tg: any = (window as any).Telegram?.WebApp;
    const res = await fetch('/api/gifts-buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': tg?.initData || '' },
      body: JSON.stringify({ gift_id: gift.id })
    });
    const json = await res.json();
    if (json.ok && json.link) {
      if (tg?.openInvoice) tg.openInvoice(json.link);
      else window.open(json.link, "_blank");
    } else {
      alert(json.error || "Ошибка при покупке");
    }
  };

  return (
    <Layout title="Магазин подарков">
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {gifts.map(g=>(
          <div key={g.id} className="bg-white rounded-2xl p-5 shadow">
            <div className="font-semibold">{g.name}</div>
            <div className="text-sm text-slate-500 mb-2">{g.desc}</div>
            <div className="flex justify-between items-center">
              <div className="font-bold">{g.price} ⭐</div>
              <button onClick={()=>buy(g)} className="bg-blue-600 text-white rounded-xl px-4 py-2">Купить</button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
