import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const userId = localStorage.getItem("user_id");
      if (!userId) return;
      const { data } = await supabase.from("balances").select("available_rub").eq("user_id", userId).single();
      if (data) setBalance(Number(data.available_rub) || 0);
    })();
  }, []);

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold">Баланс</h1>
      <p className="text-4xl mt-2">{balance} ₽</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <a href="/scan" className="bg-blue-600 text-white text-center py-3 rounded-xl">Сканировать QR</a>
        <a href="/admin" className="bg-slate-800 text-white text-center py-3 rounded-xl">Админка</a>
      </div>
    </div>
  );
}