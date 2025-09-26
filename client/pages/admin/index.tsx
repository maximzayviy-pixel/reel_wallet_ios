import { useEffect, useState } from "react";
import AdminGuard from "../../components/AdminGuard";
import AdminNav from "../../components/AdminNav";

export default function AdminDashboard(){
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(()=>{(async()=>{
    setLoading(true);
    const tg:any = (window as any).Telegram?.WebApp;
    const initData = tg?.initData || '';
    const r = await fetch('/api/admin/payment_requests', { headers:{'x-telegram-init-data': initData} }).catch(()=>null);
    const j = await r?.json();
    setRequests(j?.rows || []);
    setLoading(false);
  })()},[]);
  return (<AdminGuard><div className="p-6 max-w-4xl mx-auto">
    <h1 className="text-xl font-bold mb-4">Админка</h1>
    <AdminNav />
    <h2 className="text-lg font-semibold mb-2">Заявки</h2>
    {loading && <div>Загрузка…</div>}
    {requests.length===0 && !loading && <div className="text-gray-500">Нет заявок</div>}
    {requests.map((req:any) => (<div key={req.id} className="border p-3 rounded mb-3">
      <div className="font-mono text-xs text-gray-500">{req.id}</div>
      <div>tg_id: {req.tg_id}</div>
      <div>amount: {req.amount}</div>
      <div>status: {req.status}</div>
    </div>))}
  </div></AdminGuard>);
}