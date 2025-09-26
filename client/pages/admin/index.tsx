import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminDashboard(){
  const [requests, setRequests] = useState<any[]>([]);
  useEffect(()=>{(async()=>{
    const { data } = await supabase.from("payment_requests").select("*").order("created_at", { ascending: false });
    setRequests(data || []);
  })()},[]);
  return (<div className="p-6 max-w-2xl mx-auto">
    <h1 className="text-xl font-bold mb-4">Админка: заявки</h1>
    {requests.map(req => (<div key={req.id} className="border p-3 rounded mb-3">
      <p><b>User:</b> {req.user_id}</p>
      <p><b>Сумма:</b> {req.amount_rub || ("до " + req.max_limit_rub)}</p>
      <p><b>Статус:</b> {req.status}</p>
      <div className="flex gap-2 mt-2">
        <button onClick={async()=>{
          const sum = prompt("Сколько оплачено (₽)?", String(req.amount_rub||req.max_limit_rub||0));
          if(!sum) return;
          await fetch("/api/admin-confirm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(process.env.NEXT_PUBLIC_ADMIN_SECRET
                ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}` }
                : {}),
            },
            body: JSON.stringify({ request_id: req.id, paid_amount_rub: Number(sum), admin_id: null }),
          });
          location.reload();
        }} className="bg-green-600 text-white px-3 py-2 rounded">Подтвердить</button>
        <button onClick={async()=>{
          await fetch("/api/admin-reject", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(process.env.NEXT_PUBLIC_ADMIN_SECRET
                ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}` }
                : {}),
            },
            body: JSON.stringify({ request_id: req.id, admin_id: null }),
          });
          location.reload();
        }} className="bg-red-600 text-white px-3 py-2 rounded">Отклонить</button>
      </div>
    </div>))}
  </div>);
}