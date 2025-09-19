// pages/topup.tsx
import Layout from "../components/Layout";
import { useState } from "react";

export default function TopUp() {
  const [starsAmount, setStarsAmount] = useState<string>("");

  const tg: any =
    typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;

  const openStarsPayment = async () => {
    const stars = Number(starsAmount);
    if (!stars || stars <= 0) return alert("Укажи количество звёзд.");

    const tgId = tg?.initDataUnsafe?.user?.id;
    if (!tgId) return alert("Не удалось определить пользователя Telegram");

    const res = await fetch("/api/topup-stars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tg_id: tgId, amount_stars: stars }),
    });

    let json: any = {};
    try { json = await res.json(); } catch {}

    if (!res.ok || !json?.ok || !json?.link) {
      return alert(
        (json?.error === "INVOICE_FAILED" && (json?.details?.description || json?.details)) ||
        json?.error ||
        "Ошибка формирования инвойса"
      );
    }

    const link: string = json.link; // уже формата https://t.me/$...

    // откроем invoice или отправим в личку и покажем анимацию
    if (tg?.openTelegramLink) tg.openTelegramLink(link);
    else window.open(link, "_blank");

    const el = document.createElement("div");
    el.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/40";
    el.innerHTML =
      '<div class="bg-white rounded-2xl p-6 text-center shadow-xl animate-pulse"><div class="text-3xl mb-2">📩</div><div class="font-semibold mb-1">Ссылка отправлена в личку</div><div class="text-sm text-slate-500">Открой диалог с ботом и оплати</div></div>';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  };

  return (
    <Layout title="Пополнить баланс">
      <div className="max-w-md mx-auto px-4 pt-8 space-y-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-semibold mb-2">Пополнить звёздами Telegram</div>
          <div className="text-xs text-slate-500 mb-3">Курс: 2 ⭐ = 1 ₽</div>
          <div className="flex gap-2">
            <input
              type="number"
              value={starsAmount}
              onChange={(e) => setStarsAmount(e.target.value)}
              placeholder="Сколько ⭐"
              className="border rounded-xl flex-1 px-3 py-2"
            />
            <button
              onClick={openStarsPayment}
              className="bg-blue-600 text-white rounded-xl px-4 py-2"
            >
              Оплатить ⭐
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
