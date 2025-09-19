import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    (async () => {
      const userId = localStorage.getItem("user_id");
      if (!userId) return;
      const { data } = await supabase
        .from("balances")
        .select("available_rub")
        .eq("user_id", userId)
        .single();
      if (data) setBalance(data.available_rub);
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Баланс</h1>
      <p className="text-3xl">{balance} ₽</p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <button className="bg-blue-500 text-white p-3 rounded-xl">Пополнить</button>
        <button className="bg-green-500 text-white p-3 rounded-xl">Сканировать QR</button>
      </div>
    </div>
  );
}