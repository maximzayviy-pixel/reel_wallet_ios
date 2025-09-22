"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminUsers(){
  const [users, setUsers] = useState<any[]>([]);
  useEffect(()=>{(async()=>{ const { data } = await supabase.from("users").select("*"); setUsers(data||[]) })()},[]);
  return (<div className="p-6 max-w-2xl mx-auto">
    <h1 className="text-xl font-bold mb-4">Пользователи</h1>
    {users.map(u=>(<div key={u.id} className="border p-3 rounded mb-3">
      <p><b>ID:</b> {u.id}</p>
      <p><b>Username:</b> {u.username}</p>
      <p><b>Верификация:</b> {u.is_verified ? "✅" : "❌"}</p>
      <p><b>Бан:</b> {u.is_banned ? "🚫" : "—"}</p>
      <div className="flex gap-2 mt-2">
        <button className="bg-blue-600 text-white px-3 py-2 rounded" onClick={async()=>{
          await fetch("/api/admin-verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:u.id})}); location.reload();
        }}>Верифицировать</button>
        <button className="bg-red-600 text-white px-3 py-2 rounded" onClick={async()=>{
          await fetch("/api/admin-ban",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:u.id})}); location.reload();
        }}>Забанить</button>
        <button className="bg-green-600 text-white px-3 py-2 rounded" onClick={async()=>{
          const a = prompt("Бонус (₽):","100"); if(!a) return;
          await fetch("/api/admin-bonus",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:u.id, amount_rub:Number(a)})}); alert("Ок");
        }}>Бонус</button>
      </div>
    </div>))}
  </div>);
}