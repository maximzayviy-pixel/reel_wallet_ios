import Layout from "../components/Layout";
import { Wallet, Send, Shuffle, QrCode } from "lucide-react";

export default function Home() {
  return (
    <Layout title="Reel Wallet">
      <div className="bg-gradient-to-b from-blue-600 to-blue-500 text-white rounded-b-3xl pb-7 pt-10">
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">🙂</div>
            <div className="text-sm opacity-90">@user</div>
            <div className="ml-auto text-xs bg-white/20 rounded-full px-2 py-1 opacity-90">beta i</div>
          </div>
          <div className="text-sm/5 opacity-90">Общий баланс</div>
          <div className="text-5xl font-bold tracking-tight">0.0 ₽</div>

          <div className="flex justify-center mt-4">
            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center">
              <QrCode />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-6">
            {[
              {label: "Пополнить", href: "/topup", icon: <Wallet size={18} />},
              {label: "Перевести", href: "/", icon: <Send size={18} />},
              {label: "Обменять", href: "/", icon: <Shuffle size={18} />},
              {label: "Оплатить", href: "/scan", icon: <QrCode size={18} />},
            ].map((b, i)=>(
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
    </Layout>
  );
}
