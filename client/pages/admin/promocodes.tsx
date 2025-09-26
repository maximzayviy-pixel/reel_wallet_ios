"use client";
import AdminGuard from "../../components/AdminGuard";
import AdminTable from "../../components/AdminTable";
import { useState } from "react";

export default function AdminPromocodes(){
  const [form, setForm] = useState({ code:"", amount:0, currency:"RUB", uses:1 });
  const submit = async () => {
    await fetch("/api/admin/promocodes", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(form) });
    location.reload();
  };
  return (
    <AdminGuard>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-xl font-semibold">Промокоды</h1>

        <div className="bg-white ring-1 ring-slate-200 rounded-xl p-4 grid sm:grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <input value={form.code} onChange={e=>setForm({...form, code:e.target.value.toUpperCase()})}
            placeholder="Код" className="px-3 py-2 rounded-xl ring-1 ring-slate-300 text-sm"/>
          <input value={form.amount} onChange={e=>setForm({...form, amount:Number(e.target.value||0)})}
            type="number" placeholder="Сумма" className="px-3 py-2 rounded-xl ring-1 ring-slate-300 text-sm"/>
          <select value={form.currency} onChange={e=>setForm({...form, currency:e.target.value})}
            className="px-3 py-2 rounded-xl ring-1 ring-slate-300 text-sm">
            <option value="RUB">RUB</option>
            <option value="STARS">STARS</option>
            <option value="TON">TON</option>
          </select>
          <div className="flex gap-2">
            <input value={form.uses} onChange={e=>setForm({...form, uses:Number(e.target.value||1)})}
              type="number" placeholder="Ограничение" className="px-3 py-2 rounded-xl ring-1 ring-slate-300 text-sm flex-1"/>
            <button onClick={submit} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm">Создать</button>
          </div>
        </div>

        <AdminTable
          fetchUrl="/api/admin/promocodes"
          columns={[
            { key: "code", title: "Код" },
            { key: "amount", title: "Сумма" },
            { key: "currency", title: "Валюта" },
            { key: "uses_left", title: "Осталось" },
            { key: "created_at", title: "Создано" },
          ]}
        />
      </div>
    </AdminGuard>
  );
}
