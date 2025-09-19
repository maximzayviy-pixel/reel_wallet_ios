import Layout from "../components/Layout";
import Image from "next/image";

export default function Home() {
  return (
    <Layout title="Antarctic Wallet">
      {/* Header gradient card */}
      <div className="bg-gradient-to-b from-blue-600 to-blue-500 text-white rounded-b-3xl pb-7 pt-10">
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">🙂</div>
            <div className="text-sm opacity-90">@user</div>
            <div className="ml-auto text-xs bg-white/20 rounded-full px-2 py-1 opacity-90">beta i</div>
          </div>
          <div className="text-sm/5 opacity-90">Общий баланс</div>
          <div className="text-5xl font-bold tracking-tight">0.0 ₽</div>

          <div className="grid grid-cols-4 gap-3 mt-6">
            {["Пополнить","Перевести","Обменять","Оплатить"].map((label, i)=>(
              <div key={i} className="bg-white/10 rounded-2xl py-3 text-center text-xs backdrop-blur">
                <div className="w-8 h-8 rounded-xl bg-white/20 mx-auto mb-1"></div>
                <div>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-4">
        {/* Promo banner */}
        <div className="rounded-3xl bg-gradient-to-r from-pink-500 to-violet-500 p-4 text-white">
          <div className="text-lg font-semibold">Розыгрыш iPhone 17 Pro Max</div>
          <div className="text-xs opacity-90 mb-2">в Telegram канале</div>
          <button className="bg-white text-slate-900 rounded-full px-3 py-1 text-sm">Участвовать!</button>
        </div>

        {/* Assets list */}
        <div className="mt-5 space-y-3">
          {[
            { name: "USDT", price: "81.31 ₽", amount: "0.0 ₽", sub: "0.0 USDT", icon: "🟢" },
            { name: "TON", price: "249.09 ₽", amount: "0.0 ₽", sub: "0.0 TON", icon: "🔷", tag: "NEW" }
          ].map((a, i)=>(
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">{a.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{a.name}</div>
                  {a.tag && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">{a.tag}</span>}
                </div>
                <div className="text-xs text-slate-500">{a.price}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{a.amount}</div>
                <div className="text-xs text-slate-500">{a.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
