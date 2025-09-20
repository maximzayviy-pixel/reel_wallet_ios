import Layout from "../components/Layout";
import { useState } from "react";

export default function TopUp() {
  const [starsAmount, setStarsAmount] = useState<string>("");
  const [tonAmount, setTonAmount] = useState<string>("");
  const tg: any = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;

  const openStarsPayment = async () => {
    const stars = Number(starsAmount);
    if (!stars || stars <= 0) return alert("Укажи количество звёзд.");
    const tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const bcId = tg?.initDataUnsafe?.business_connection_id || tg?.initDataUnsafe?.business?.id;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 bg-black/40 flex items-center justify-center';
    overlay.innerHTML = '<div class="bg-white rounded-2xl px-6 py-4 text-center shadow animate-pulse">Готовим оплату…</div>';
    document.body.appendChild(overlay);

    try {
      const res = await fetch('/api/stars-invoice-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': tg?.initData || '' },
        body: JSON.stringify({ amount_stars: stars, tg_id: tgId, business_connection_id: bcId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.link) throw new Error(json?.error || 'INVOICE_FAILED');

      if (tg?.openTelegramLink) tg.openTelegramLink(json.link);
      else window.open(json.link, "_blank");

      const toast = document.createElement('div');
      toast.className = 'fixed left-1/2 -translate-x-1/2 bottom-6 z-50 bg-slate-900 text-white px-4 py-2 rounded-xl';
      toast.textContent = 'Открой чат с ботом для оплаты';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } catch (err: any) {
      alert(err?.message || 'Ошибка формирования инвойса');
    } finally {
      overlay.remove();
    }
  };

  const openCryptoCloud = () => {
    const ton = Number(tonAmount);
    if (!ton || ton <= 0) return alert("Укажи количество TON.");
    const base = process.env.NEXT_PUBLIC_CRYPTOCLOUD_URL || "";
    if (!base) return alert("Добавь NEXT_PUBLIC_CRYPTOCLOUD_URL в .env");
    const url = base.includes('?') ? `${base}&amount=${ton}` : `${base}?amount=${ton}`;
    if (tg?.openLink) tg.openLink(url, { try_instant_view: true });
    else window.open(url, "_blank");
  };

  return (
    <Layout title="Пополнить баланс">
      <div className="max-w-md mx-auto px-4 pt-8 space-y-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-semibold mb-2">Пополнить звёздами Telegram</div>
          <div className="text-xs text-slate-500 mb-3">Курс: 2 ⭐ = 1 ₽</div>
          <div className="flex gap-2">
            <input type="number" value={starsAmount} onChange={(e)=>setStarsAmount(e.target.value)} placeholder="Сколько ⭐" className="border rounded-xl flex-1 px-3 py-2" />
            <button onClick={openStarsPayment} className="bg-blue-600 text-white rounded-xl px-4 py-2">Оплатить ⭐</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-semibold mb-2">Пополнить TON через CryptoCloud</div>
          <div className="text-xs text-slate-500 mb-3">Курс: 1 TON = 300 ₽</div>
          <div className="flex gap-2">
            <input type="number" value={tonAmount} onChange={(e)=>setTonAmount(e.target.value)} placeholder="Сколько TON" className="border rounded-xl flex-1 px-3 py-2" />
            <button onClick={openCryptoCloud} className="bg-slate-900 text-white rounded-xl px-4 py-2">Оплатить TON</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
