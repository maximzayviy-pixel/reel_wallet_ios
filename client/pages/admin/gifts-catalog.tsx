import { useEffect, useState } from "react";
import AdminGuard from "../../components/AdminGuard";
import AdminTable from "../../components/AdminTable";

export default function AdminGiftsCatalog(){
  const [link, setLink] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const add = async () => {
    setBusy(true); setError(null);
    const r = await fetch('/api/admin/gifts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ link, price_rub: Number(price), image_url: image, title }) });
    const j = await r.json();
    if (!j.ok) setError(j.error || 'Ошибка');
    setBusy(false);
  };

  return (
    <AdminGuard>
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <h1 className="text-xl font-semibold">Gifts catalog</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={link} onChange={e=>setLink(e.target.value)} placeholder="https://t.me/nft/EasterEgg-115089" className="h-10 px-3 rounded-lg ring-1 ring-slate-200" />
          <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Цена, ₽" className="h-10 px-3 rounded-lg ring-1 ring-slate-200" />
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Название (необязательно)" className="h-10 px-3 rounded-lg ring-1 ring-slate-200" />
          <input value={image} onChange={e=>setImage(e.target.value)} placeholder="URL картинки (необязательно)" className="h-10 px-3 rounded-lg ring-1 ring-slate-200" />
          <button onClick={add} disabled={busy} className="h-10 rounded-lg bg-blue-600 text-white">Добавить</button>
          {error && <div className="text-red-600">{error}</div>}
        </div>

        <AdminTable
          fetchUrl="/api/admin/gifts"
          columns={[
            { key: "id", title: "ID" },
            { key: "title", title: "Название" },
            { key: "slug", title: "Слаг" },
            { key: "number", title: "Номер" },
            { key: "price_rub", title: "Цена ₽" },
            { key: "enabled", title: "Вкл" },
            { key: "created_at", title: "Создано" },
          ]}
        />
      </div>
    </AdminGuard>
  )
}
