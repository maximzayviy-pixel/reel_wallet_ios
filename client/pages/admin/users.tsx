import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("users").select("*");
      if (data) setUsers(data);
    })();
  }, []);

  const banUser = async (id: string) => {
    await fetch("/api/admin-ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id }),
    });
    setUsers(users.map(u => u.id === id ? { ...u, is_banned: true } : u));
  };

  const verifyUser = async (id: string) => {
    await fetch("/api/admin-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id }),
    });
    setUsers(users.map(u => u.id === id ? { ...u, is_verified: true } : u));
  };

  const grantBonus = async (id: string) => {
    const amount = prompt("Сколько бонусов начислить (₽)?");
    if (!amount) return;
    await fetch("/api/admin-bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id, amount_rub: parseFloat(amount) }),
    });
    alert("Бонус начислен");
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Управление пользователями</h1>
      {users.map((user) => (
        <div key={user.id} className="border p-3 rounded mb-3">
          <p><b>ID:</b> {user.id}</p>
          <p><b>Username:</b> {user.username}</p>
          <p><b>Верификация:</b> {user.is_verified ? "✅" : "❌"}</p>
          <p><b>Бан:</b> {user.is_banned ? "🚫" : "—"}</p>
          <div className="mt-2">
            <button onClick={() => verifyUser(user.id)} className="bg-blue-500 text-white px-3 py-1 rounded mr-2">Верифицировать</button>
            <button onClick={() => banUser(user.id)} className="bg-red-500 text-white px-3 py-1 rounded mr-2">Забанить</button>
            <button onClick={() => grantBonus(user.id)} className="bg-green-500 text-white px-3 py-1 rounded">Бонус</button>
          </div>
        </div>
      ))}
    </div>
  );
}