// pages/browser.tsx — Marketplace for NFT gifts
import { useEffect, useState } from "react";
import Layout from "../components/Layout";

type Gift = {
  id: number; title: string; slug: string; number: number;
  tme_link: string; price_rub: number; image_url?: string;
};

export default function Browser() {
  const [tgId, setTgId] = useState<number | undefined>(undefined);
  const [items, setItems] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Gift | null>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    try {
      // @ts-ignore
      const id = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (id) setTgId(Number(id));
    } catch {}
    fetch('/api/gifts/list').then(r=>r.json()).then(j=>{
      if (j.ok) setItems(j.items); else setError(j.error || 'Ошибка загрузки');
    }).catch(()=>setError('Ошибка сети')).finally(()=>setLoading(false));
  }, []);

  const buy = async (gift: Gift) => {
    setBuying(true);
    try {
      const r = await fetch('/api/gifts/buy', {
        method: 'POST', headers: {'Content-Type':'application/json', 'x-init-data': (window as any)?.Telegram?.WebApp?.initData || '' } ,
        body: JSON.stringify({ gift_id: gift.id })
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Ошибка');
      // open link to transfer the collectible gift on Telegram
      window.open(j.tme_link, '_blank');
      alert('Покупка успешна! Ссылка на подарок открыта.');
    } catch (e:any) {
      alert('Не удалось купить: ' + e.message);
    } finally { setBuying(false); }
  };

  return (
    <Layout title="Обмен — маркетплейс подарков">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        {loading && <div className="text-slate-500">Загрузка...</div>}
        {error && <div className="text-red-600">{error}</div>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {items.map(g => (
            <button key={g.id} onClick={()=>setSelected(g)} className="rounded-2xl bg-white ring-1 ring-slate-200 p-3 text-left">
              <div className="aspect-square rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden">
                {g.image_url ? <img src={g.image_url} alt={g.title} className="w-full h-full object-cover" /> : <span className="text-4xl">🎁</span>}
              </div>
              <div className="mt-2">
                <div className="text-sm font-medium">{g.title}</div>
                <div className="text-xs text-slate-500">#{g.number}</div>
                <div className="text-sm font-semibold mt-1">{g.price_rub} ₽</div>
              </div>
            </button>
          ))}
        </div>

        {/* Modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={()=>setSelected(null)}>
            <div className="bg-white rounded-2xl w-full sm:w-[420px] p-4 m-2" onClick={e=>e.stopPropagation()}>
              <div className="flex gap-3">
                <div className="w-28 h-28 rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center">
                  {selected.image_url ? <img src={selected.image_url} className="w-full h-full object-cover" /> : <span className="text-4xl">🎁</span>}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{selected.title}</div>
                  <div className="text-xs text-slate-500 mb-2">
                    <a className="underline" href={selected.tme_link} target="_blank">Открыть в Telegram</a>
                  </div>
                  <div className="text-2xl font-bold">{selected.price_rub} ₽</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button className="h-11 rounded-xl ring-1 ring-slate-200" onClick={()=>setSelected(null)}>Отмена</button>
                <button className="h-11 rounded-xl bg-blue-600 text-white disabled:opacity-60" disabled={buying} onClick={()=>buy(selected!)}>
                  Купить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
