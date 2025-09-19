import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payment_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setRequests(data);
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Админка: Заявки</h1>
      {requests.map((req) => (
        <div key={req.id} className="border p-3 rounded mb-3">
          <p><b>User:</b> {req.user_id}</p>
          <p><b>Сумма:</b> {req.amount_rub || ("до " + req.max_limit_rub)}</p>
          <p><b>Статус:</b> {req.status}</p>
          <button className="bg-green-500 text-white px-3 py-1 rounded mr-2">Подтвердить</button>
          <button className="bg-red-500 text-white px-3 py-1 rounded">Отклонить</button>
        </div>
      ))}
    </div>
  );
}