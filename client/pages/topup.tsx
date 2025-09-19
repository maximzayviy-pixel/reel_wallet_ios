import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function TopUp() {
  const [starsAmount, setStarsAmount] = useState<string>("");
  const [tonAmount, setTonAmount] = useState<string>("");
  const tg: any = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;

  const openStarsPayment = async () => {
    const stars = Number(starsAmount);
    if (!stars || stars <= 0) return alert("Укажи количество звёзд.");
    const tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const bcId = tg?.initDataUnsafe?.business_connection_id || tg?.initDataUnsafe?.business?.id;
    const res = await fetch('/api/stars-invoice-bot', { method:'POST', headers:{'Content-Type':'application/json', 'x-telegram-init-data': (tg?.initData || '')}, body: JSON.stringify({ amount_stars: stars, tg_id: tgId, business_connection_id: bcId }) });
    let json:any = {}; try { json = await res.json(); } catch { json = {}; }

      if (json.ok) {
        // Try open invoice inside Mini App; if not, покажем уведомление
        if (tg?.openInvoice) tg.openInvoice(json.link);
        // Покажи анимацию отправки в личку
        const el = document.createElement('div');
        el.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40';
        el.innerHTML = '<div class="bg-white rounded-2xl p-6 text-center shadow-xl animate-pulse"><div class="text-3xl mb-2">📩</div><div class="font-semibold mb-1">Ссылка отправлена в личку</div><div class="text-sm text-slate-500">Открой диалог с ботом и оплати</div></div>';
        document.body.appendChild(el);
        setTimeout(()=>{ el.remove(); }, 1800);
        return;
      }

    if (!res.ok) return alert((json && (json.error || json.description)) || 'Ошибка формирования инвойса');
    const link = json.invoice_url;
    if (tg?.openInvoice) tg.openInvoice(link);
    else if (tg?.openTelegramLink) tg.openTelegramLink(link);
    else window.open(link, "_blank");
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
