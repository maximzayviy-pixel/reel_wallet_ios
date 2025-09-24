import Layout from "../components/Layout";
import useBanRedirect from '../lib/useBanRedirect';
import { useMemo, useState } from "react";

export default function TopUp() {
  // Redirect banned users
  useBanRedirect();
  // Redirect banned users
  useBanRedirect();
  const [starsAmount, setStarsAmount] = useState<string>("");

  // Telegram user id for TON memo
  const [tgId, setTgId] = useState<number | null>(null);
  useEffect(() => {
    const tg: any = (window as any)?.Telegram?.WebApp;
    const id = tg?.initDataUnsafe?.user?.id;
    if (id) setTgId(id);
  }, []);

  const tg: any =
    typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;

  const rub = useMemo(() => {
    const s = Number(starsAmount || 0);
    if (!isFinite(s) || s <= 0) return 0;
    return s / 2; // 2⭐ = 1₽
  }, [starsAmount]);

  const setPreset = (v: number) => setStarsAmount(String(v));

  const openStarsPayment = async () => {
    const stars = Number(starsAmount);
    if (!stars || stars <= 0) return alert("Укажи количество звёзд.");
    const tgId =
      (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id ||
      undefined;
    const bcId =
      tg?.initDataUnsafe?.business_connection_id ||
      tg?.initDataUnsafe?.business?.id;

    const overlay = document.createElement("div");
    overlay.className =
      "fixed inset-0 z-50 bg-black/40 flex items-center justify-center";
    overlay.innerHTML =
      '<div class="bg-white rounded-2xl px-6 py-4 text-center shadow animate-pulse">Готовим оплату…</div>';
    document.body.appendChild(overlay);

    try {
      const res = await fetch("/api/stars-invoice-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": tg?.initData || "",
        },
        body: JSON.stringify({
          amount_stars: stars,
          tg_id: tgId,
          business_connection_id: bcId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.link)
        throw new Error(json?.error || "INVOICE_FAILED");

      if (tg?.openTelegramLink) tg.openTelegramLink(json.link);
      else window.open(json.link, "_blank");

      const toast = document.createElement("div");
      toast.className =
        "fixed left-1/2 -translate-x-1/2 bottom-6 z-50 bg-slate-900 text-white px-4 py-2 rounded-xl";
      toast.textContent = "Открой чат с ботом для оплаты";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } catch (err: any) {
      alert(err?.message || "Ошибка формирования инвойса");
    } finally {
      overlay.remove();
    }
  };

  return (
    <Layout title="Пополнить баланс">
      <div className="max-w-md mx-auto px-4 pt-8 space-y-6">
        {/* Stars top-up */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Пополнить звёздами Telegram</div>
            <div className="text-xs text-slate-500">Курс: 2 ⭐ = 1 ₽</div>
          </div>

          {/* Input */}
          <div className="mt-3">
            <label className="text-[11px] text-slate-500">Количество ⭐</label>
            <div className="mt-1 flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={starsAmount}
                  onChange={(e) => setStarsAmount(e.target.value)}
                  placeholder="Например, 200"
                  className="w-full rounded-xl ring-1 ring-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-slate-300 pr-12"
                />
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                  ⭐
                </div>
              </div>
              <button
                onClick={openStarsPayment}
                className="whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-sm"
              >
                Оплатить
              </button>
            </div>

            {/* Presets */}
            <div className="mt-2 flex flex-wrap gap-2">
              {[100, 200, 500, 1000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPreset(v)}
                  className="text-xs rounded-full px-3 py-1 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  +{v} ⭐
                </button>
              ))}
            </div>

            {/* Conversion */}
            <div className="mt-3 text-xs text-slate-600">
              {rub > 0 ? (
                <>К зачисленю ≈ <span className="font-medium">{rub.toFixed(2)} ₽</span></>
              ) : (
                <>Введи количество звёзд, чтобы увидеть сумму в ₽</>
              )}
            </div>

            {/* Note */}
            <div className="mt-3 text-[11px] text-slate-500">
              После нажатия «Оплатить» откроется чат с ботом, где нужно подтвердить
              покупку звёзд. Баланс в приложении обновится автоматически.
            </div>
          </div>
        </div>

        {/* TON top-up instructions */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Пополнить TON</div>
            <div className="text-xs text-slate-500">Курс: 1 TON = 300 ₽</div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="text-[11px] text-slate-500">Адрес кошелька для пополнения</div>
            <div className="text-sm font-mono break-all bg-slate-50 rounded-xl p-3 select-all">
              {process.env.NEXT_PUBLIC_TON_ADMIN_WALLET || 'EQCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'}
            </div>
            <div className="text-[11px] text-slate-500">
              При отправке перевода укажите в поле Memo ваш Telegram ID.
              {tgId && (
                <>
                  {' '}Ваш ID: <span className="font-medium">{tgId}</span>
                </>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              После поступления TON на кошелек администратор вручную начислит TON на ваш баланс.
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
