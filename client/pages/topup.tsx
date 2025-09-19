import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function TopUp() {
  const [stars, setStars] = useState<string>("");
  const [ton, setTon] = useState<string>("");
  const tg: any = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;

  const openStarsPayment = () => {
    // Ожидаем, что ты задашь ссылку-инвойс через ENV или создашь его на бэке.
    const invoiceUrl = process.env.NEXT_PUBLIC_STARS_INVOICE_URL || "";
    if (tg && tg.openTelegramLink && invoiceUrl) {
      tg.openTelegramLink(invoiceUrl);
    } else {
      alert("Добавь NEXT_PUBLIC_STARS_INVOICE_URL в переменные окружения (invoice/attach-pay ссылку для звёзд).");
    }
  };

  const openCryptoCloud = () => {
    const ccUrl = process.env.NEXT_PUBLIC_CRYPTOCLOUD_URL || "";
    if (tg && tg.openLink && ccUrl) {
      tg.openLink(ccUrl, { try_instant_view: true });
    } else if (ccUrl) {
      window.open(ccUrl, "_blank");
    } else {
      alert("Добавь NEXT_PUBLIC_CRYPTOCLOUD_URL в переменные окружения (ссылка на форму оплаты TON).");
    }
  };

  return (
    <Layout title="Пополнить баланс">
      <div className="max-w-md mx-auto px-4 pt-8 space-y-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-semibold mb-2">Пополнить звёздами Telegram</div>
          <div className="text-xs text-slate-500 mb-3">Курс: 2 ⭐ = 1 ₽</div>
          <button onClick={openStarsPayment} className="w-full bg-blue-600 text-white rounded-2xl py-3">Открыть оплату звёздами</button>
          <div className="text-xs text-slate-400 mt-2">
            Оплата делается через встроенную систему Telegram Stars. Для продакшена укажи invoice ссылку (см. документацию).
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-semibold mb-2">Пополнить TON через CryptoCloud</div>
          <div className="text-xs text-slate-500 mb-3">Курс: 1 TON = 300 ₽</div>
          <button onClick={openCryptoCloud} className="w-full bg-slate-900 text-white rounded-2xl py-3">Открыть форму CryptoCloud</button>
        </div>
      </div>
    </Layout>
  );
}
