// pages/index.tsx
import Skeleton from '../components/Skeleton';
import Layout from "../components/Layout";
import { Wallet, Send, Shuffle, QrCode } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [stars, setStars] = useState<number>(0);
  const [ton, setTon] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const tg: any = useMemo(
    () => (typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null),
    []
  );

  const tgIdRef = useRef<number | null>(null);
  const pollingRef = useRef<any>(null);

  // единая функция получения баланса
  const fetchBalance = async () => {
    const tgId =
      tg?.initDataUnsafe?.user?.id ||
      (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;

    tgIdRef.current = tgId || null;
    if (!tgId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/my-balance?tg_id=${tgId}`);
      const json = await res.json();
      const src = json?.balance ? json.balance : json;
      setStars(Number(src?.stars || 0));
      setTon(Number(src?.ton || 0));
    } catch (e) {
      console.warn("balance fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  // инициализация юзера + первый фетч
  useEffect(() => {
    try {
      const u = tg?.initDataUnsafe?.user;
      if (u) setUser(u);
    } catch {}

    fetchBalance();

    // подписка на закрытие инвойса
    const onInvoiceClosed = (data: any) => {
      if (data?.status === "paid") {
        fetchBalance();
      }
    };
    tg?.onEvent?.("invoiceClosed", onInvoiceClosed);

    // обновлять при возврате во вкладку
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchBalance();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", fetchBalance);

    // лёгкий пуллинг
    pollingRef.current = setInterval(fetchBalance, 15000);

    return () => {
      tg?.offEvent?.("invoiceClosed", onInvoiceClosed);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", fetchBalance);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tg]);

  const total = (stars / 2) + (ton * 300);

  return (
    <Layout title="Reel Wallet">
      <div className="bg-gradient-to-b from-blue-600 to-blue-500 text-white rounded-b-3xl pb-7 pt-10">
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            {user?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photo_url} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">🙂</div>
            )}
            <div className="text-sm opacity-90">
              {user?.username ? `@${user.username}` : (user?.first_name || 'Гость')}
            </div>
            <div className="ml-auto text-xs bg-white/20 rounded-full px-2 py-1 opacity-90">Reel</div>
          </div>

          <div className="text-sm/5 opacity-90">Общий баланс</div>
          <div className="text-5xl font-bold tracking-tight">
            {loading ? <Skeleton className="h-10 w-32 mt-2" /> : `${total.toFixed(2)} ₽`}
          </div>

          <div className="grid grid-cols-4 gap-3 mt-6">
            {[
              { label: "Пополнить", href: "/topup", icon: <Wallet size={18} /> },
              { label: "Перевести", href: "transfer", icon: <Send size={18} /> },
              { label: "Обменять", href: "/obmen", icon: <Shuffle size={18} /> },
              { label: "Оплатить", href: "/scan", icon: <QrCode size={18} /> },
            ].map((b, i) => (
              <a key={i} href={b.href} className="bg-white/10 rounded-2xl py-3 text-center text-xs backdrop-blur block">
                <div className="w-10 h-10 rounded-xl bg-white/20 mx-auto mb-1 flex items-center justify-center">
                  {b.icon}
                </div>
                <div>{b.label}</div>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-4 space-y-4">
        <a
          href="https://t.me/reelwallet"
          target="_blank"
          rel="noreferrer"
          className="block rounded-3xl bg-gradient-to-r from-blue-500 to-indigo-600 p-5 text-white"
        >
          <div className="text-lg font-semibold">Подписывайся на наш Telegram-канал</div>
          <div className="text-xs opacity-90 mb-2">@reelwallet</div>
          <span className="bg-white text-slate-900 rounded-full px-3 py-1 text-sm inline-block">Открыть канал</span>
        </a>

        {/* список активов */}
        {[
          {
            name: "Звёзды Telegram",
            amount: stars,
            sub: `${(stars / 2).toFixed(2)} ₽`,
            icon: "⭐",
            dim: false,
          },
          {
            name: "TON СКОРО!",
            amount: ton,
            sub: "—",
            icon: (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="https://ton.org/download/ton_symbol.png"
                alt="TON"
                className="w-5 h-5"
              />
            ),
            dim: true,
          },
        ].map((a, i) => (
          <div
            key={i}
            className={
              "bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 " +
              (a.dim ? "opacity-50" : "")
            }
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">
              {a.icon}
            </div>
            <div className="flex-1">
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-slate-500">{a.sub}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{a.amount}</div>
              <div className="text-xs text-slate-500"></div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
