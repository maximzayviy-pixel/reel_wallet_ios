import Layout from '../components/Layout';
import Skeleton from '../components/Skeleton';
import { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles, Filter, ArrowUpDown, Star, Gift, AlertCircle } from 'lucide-react';

type GiftItem = {
  slug: string;
  title: string;
  description?: string;
  stars_price: number;
  preview_url?: string;
};

const Shimmer = ({ className='' }) => (
  <div className={`relative overflow-hidden bg-slate-200/70 rounded-xl ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    <style jsx>{`
      @keyframes shimmer { 100% { transform: translateX(100%); } }
    `}</style>
  </div>
);

export default function Browser() {
  const tg: any = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
  const tgId = tg?.initDataUnsafe?.user?.id;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GiftItem[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'popular'|'cheap'|'expensive'>('popular');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch('/api/gifts/catalog');
        const j = await r.json();
        if (mounted) {
          setItems(j.ok ? j.items : []);
        }
      } catch {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    let arr = items.filter(i =>
      !text ||
      i.title.toLowerCase().includes(text) ||
      (i.description||'').toLowerCase().includes(text)
    );
    if (sort === 'cheap') arr = arr.sort((a,b)=>a.stars_price-b.stars_price);
    else if (sort === 'expensive') arr = arr.sort((a,b)=>b.stars_price-a.stars_price);
    return arr;
  }, [items, q, sort]);

  const buy = async (gift: GiftItem) => {
    if (!tgId) return alert('Открой через Telegram Mini App');
    const r = await fetch('/api/gifts/create-invoice', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ tg_id: tgId, gift_slug: gift.slug })
    });
    const j = await r.json();
    if (!j.ok) return alert(j.error || 'Не удалось создать инвойс');
    if (tg?.openInvoice) tg.openInvoice(j.link);
    else if (tg?.openTelegramLink) tg.openTelegramLink(j.link);
    else window.open(j.link, '_blank');
  };

  return (
    <Layout title="Магазин подарков">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur">
        <div className="max-w-md mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Gift size={18}/>
            </div>
            <div>
              <div className="text-sm text-slate-500">Reel Wallet</div>
              <div className="font-semibold">Подарки за ⭐</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={()=>setSort(s=> s==='cheap' ? 'expensive' : s==='expensive' ? 'popular' : 'cheap')}
                className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs flex items-center gap-1">
                <ArrowUpDown size={14}/> {sort==='popular'?'популярные': sort==='cheap'?'сначала дешёвые':'сначала дорогие'}
              </button>
            </div>
          </div>
          <div className="mt-3 relative">
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder="Поиск подарка…"
              className="w-full pl-10 pr-12 py-3 rounded-2xl bg-slate-100 outline-none text-sm"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Очистить</button>}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-8">
        {loading && (
          <div className="grid grid-cols-1 gap-3 mt-4">
            {Array.from({length:6}).map((_,i)=>(
              <div key={i} className="bg-white rounded-2xl p-3 shadow-sm">
                <div className="flex gap-3">
                  <Shimmer className="w-24 h-24"/>
                  <div className="flex-1 space-y-2">
                    <Shimmer className="h-4 w-2/3"/>
                    <Shimmer className="h-3 w-1/2"/>
                    <Shimmer className="h-3 w-3/4"/>
                    <div className="flex gap-2 pt-1">
                      <Shimmer className="h-8 w-24"/>
                      <Shimmer className="h-8 w-16"/>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center text-slate-500 mt-10">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <AlertCircle className="text-slate-400"/>
            </div>
            <div className="mt-3 font-medium">Ничего не нашли</div>
            <div className="text-sm">Попробуй изменить запрос</div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 mt-4">
          {filtered.map(g=>(
            <article key={g.slug} className="bg-white rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex gap-3">
                <div className="relative">
                  <img src={g.preview_url || '/gifts/placeholder.svg'} className="w-24 h-24 rounded-xl object-cover" />
                  <div className="absolute -top-2 -right-2 bg-white rounded-xl px-2 py-1 shadow text-[11px] flex items-center gap-1">
                    <Star size={12} className="opacity-70"/> {g.stars_price}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{g.title}</div>
                  {g.description && <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{g.description}</div>}
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={()=>buy(g)} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs active:scale-[0.98]">
                      Купить за {g.stars_price} ⭐
                    </button>
                    <a href="https://t.me/reelwallet" target="_blank" rel="noreferrer"
                       className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs">Подробнее</a>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-400">
          Каталог подарков обновляется. Идеи? Напиши нам в @reelwallet
        </div>
      </main>
    </Layout>
  );
}
