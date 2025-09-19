import Layout from "../components/Layout";
import { useState } from "react";

export default function TopUp() {
  const [ton, setTon] = useState<string>("");
  const [stars, setStars] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const submit = async (type: "ton" | "stars") => {
    const uid = userId || localStorage.getItem("user_id") || "anonymous";
    const url = type === "ton" ? "/api/topup-ton" : "/api/topup-stars";
    const body = type === "ton" ? { user_id: uid, amount_ton: Number(ton) } : { user_id: uid, stars: Number(stars) };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    alert(res.ok ? "Пополнение зачислено: " + data.rub + " ₽" : "Ошибка: " + (data.error?.message || data.error));
  };

  return (
    <Layout title="Пополнить">
      <div className="max-w-md mx-auto px-4 pt-8 space-y-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="text-sm text-slate-500 mb-1">ID пользователя</div>
          <input value={userId} onChange={(e)=>setUserId(e.target.value)} placeholder="(опционально) UUID" className="border rounded-xl w-full px-3 py-2" />
          <div className="text-xs text-slate-400 mt-1">Если оставить пустым — возьмём из localStorage.</div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-semibold mb-2">Пополнить звёздами Telegram</div>
          <div className="text-xs text-slate-500 mb-3">Курс: 2 ⭐ = 1 ₽</div>
          <div className="flex gap-2">
            <input type="number" value={stars} onChange={(e)=>setStars(e.target.value)} placeholder="Сколько ⭐" className="border rounded-xl flex-1 px-3 py-2" />
            <button onClick={()=>submit("stars")} className="bg-blue-600 text-white rounded-xl px-4 py-2">Пополнить</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-semibold mb-2">Пополнить TON</div>
          <div className="text-xs text-slate-500 mb-3">Курс: 1 TON = 300 ₽</div>
          <div className="flex gap-2">
            <input type="number" value={ton} onChange={(e)=>setTon(e.target.value)} placeholder="Сколько TON" className="border rounded-xl flex-1 px-3 py-2" />
            <button onClick={()=>submit("ton")} className="bg-slate-900 text-white rounded-xl px-4 py-2">Пополнить</button>
          </div>
          <div className="text-xs text-slate-400 mt-2">Интеграция с CryptoCloud/IAP может дергать этот же endpoint как вебхук.</div>
        </div>
      </div>
    </Layout>
  );
}
