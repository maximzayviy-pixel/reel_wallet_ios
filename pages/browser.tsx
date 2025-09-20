
import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function Browser() {
  const [gifts, setGifts] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  useEffect(()=>{
    fetch("/api/gifts-list").then(r=>r.json()).then(setGifts);
  },[]);

  const createListing = async () => {
    if(!name || !price) return alert("Укажи название и цену");
    const tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const res = await fetch("/api/gifts-create-listing",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name, price_stars:Number(price), seller_tg_id:tgId})
    });
    const j = await res.json();
    if(j.ok){ alert("Отправлено на модерацию"); setName(""); setPrice(""); }
    else alert(j.error||"Ошибка");
  };

  return (
    <Layout title="Витрина подарков">
      <div className="max-w-md mx-auto p-4 space-y-6">
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="font-semibold mb-2">Продать свой подарок</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Название" className="border rounded px-2 py-1 w-full mb-2"/>
          <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Цена в ⭐" type="number" className="border rounded px-2 py-1 w-full mb-2"/>
          <button onClick={createListing} className="bg-blue-600 text-white rounded px-3 py-2">Выставить</button>
        </div>

        <div className="space-y-3">
          {gifts.map((g,i)=>(
            <div key={i} className="bg-white rounded-xl p-4 shadow flex justify-between">
              <div>
                <div className="font-semibold">{g.name}</div>
                <div className="text-sm text-slate-500">{g.price_stars} ⭐</div>
              </div>
              <a href={`/api/gifts-buy?id=${g.id}`} className="bg-green-600 text-white px-3 py-1 rounded">Купить</a>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
