import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";

type Listing = {
  id: string;
  seller_tg_id: string;
  title: string;
  media_url: string | null;
  price_stars: number;
  quantity: number;
  status: "pending" | "active" | "archived";
  created_at: string;
};

const tg = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;

export default function Browser() {
  const [list, setList] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [qty, setQty] = useState<number | "">(1);
  const [mediaUrl, setMediaUrl] = useState("");

  const tgId = useMemo<number | undefined>(() => {
    try {
      return tg?.initDataUnsafe?.user?.id;
    } catch {
      return undefined;
    }
  }, []);

  async function fetchList() {
    setLoading(true);
    try {
      const r = await fetch("/api/gifts-list");
      const j = await r.json();
      setList(j.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function createListing(e: React.FormEvent) {
    e.preventDefault();
    if (!tgId) return alert("Открой Mini App внутри Telegram");
    const p = Number(price);
    const q = Number(qty);
    if (!title || !p || p <= 0 || !q || q <= 0) return alert("Заполни название/цену/количество");
    const r = await fetch("/api/gifts-create-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, price_stars: p, quantity: q, media_url: mediaUrl || null, seller_tg_id: tgId }),
    });
    const j = await r.json();
    if (!r.ok) return alert(j.error || "Ошибка создания листинга");
    alert("Листинг создан и отправлен на модерацию");
    setTitle(""); setPrice(""); setQty(1); setMediaUrl("");
    fetchList();
  }

  async function buy(listingId: string) {
    if (!tgId) return alert("Открой Mini App внутри Telegram");
    const r = await fetch("/api/gifts-buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: listingId, buyer_tg_id: tgId }),
    });
    const j = await r.json();
    if (!r.ok) return alert(j.error || "Не удалось создать счёт");
    const link = j.invoice_link as string;
    if ((window as any).Telegram?.WebApp?.openInvoice) {
      (window as any).Telegram.WebApp.openInvoice(link);
    } else if ((window as any).Telegram?.WebApp?.openTelegramLink) {
      (window as any).Telegram.WebApp.openTelegramLink(link);
    } else {
      window.open(link, "_blank");
    }
  }

  useEffect(() => { fetchList(); }, []);

  return (
    <Layout title="Витрина подарков">
      <div className="max-w-3xl mx-auto px-4 pb-10">
        <h1 className="text-xl font-semibold mt-6 mb-3">Активные подарки</h1>
        {loading ? <div className="animate-pulse h-24 bg-slate-100 rounded-2xl" /> : (
          <div className="grid grid-cols-2 gap-3">
            {list.map(it => (
              <div key={it.id} className="rounded-2xl bg-white shadow-sm p-3">
                <div className="aspect-square rounded-xl bg-slate-100 overflow-hidden mb-2">
                  {it.media_url ? <img src={it.media_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-3xl">🎁</div>}
                </div>
                <div className="font-semibold">{it.title}</div>
                <div className="text-xs text-slate-500 mb-2">⭐ {it.price_stars} • Осталось {it.quantity}</div>
                <button onClick={() => buy(it.id)} className="w-full rounded-xl bg-blue-600 text-white py-2 text-sm">Купить</button>
              </div>
            ))}
            {!list.length && <div className="col-span-2 text-slate-500 text-sm">Пока ничего нет</div>}
          </div>
        )}

        <h2 className="text-xl font-semibold mt-8 mb-3">Продать свой подарок</h2>
        <form onSubmit={createListing} className="rounded-2xl bg-white shadow-sm p-4 space-y-3">
          <input className="w-full border rounded-xl px-3 py-2" placeholder="Название" value={title} onChange={e=>setTitle(e.target.value)} />
          <input className="w-full border rounded-xl px-3 py-2" placeholder="Ссылка на изображение (опционально)" value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className="w-full border rounded-xl px-3 py-2" placeholder="Цена в ⭐" type="number" value={price as any} onChange={e=>setPrice(e.target.value?Number(e.target.value):"")} />
            <input className="w-full border rounded-xl px-3 py-2" placeholder="Количество" type="number" value={qty as any} onChange={e=>setQty(e.target.value?Number(e.target.value):"")} />
          </div>
          <button className="w-full rounded-xl bg-slate-900 text-white py-2">Отправить на модерацию</button>
        </form>
      </div>
    </Layout>
  );
}
