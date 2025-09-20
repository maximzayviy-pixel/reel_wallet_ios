import Layout from "../components/Layout";
import Preloader from "../components/Preloader";
import { useEffect, useState } from "react";
type Row = { id:string; type:string; amount?:number; amount_rub?:number; created_at?:string; status?:string };
export default function History(){
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{(async()=>{
      try {
        const tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
        if(!tgId) { setLoading(false); return; }
        const r = await fetch(`/api/history?tg_id=${tgId}`);
        const j = await r.json();
        if(j.ok) setRows(j.items||[]);
      } finally { setLoading(false); }
    })();},[]);
  return (<Layout title="История операций">
    {loading? <Preloader fullscreen/> : (
      <div className="max-w-md mx-auto p-4 space-y-3">
        {rows.length===0 && <div className="text-center text-slate-500 mt-10">Пока пусто</div>}
        {rows.map((r)=> (
          <div key={r.id} className="bg-white rounded-xl p-4 shadow flex items-center justify-between">
            <div><div className="font-medium">{r.type}</div>
              <div className="text-xs text-slate-500">{new Date(r.created_at||'').toLocaleString()}</div></div>
            <div className="text-right">
              <div className="font-semibold">{(r.amount_rub ?? r.amount ?? 0)} {r.amount_rub ? "₽" : "⭐"}</div>
              {r.status && <div className="text-xs text-slate-500">{r.status}</div>}
            </div>
          </div>
        ))}
      </div>
    )}
  </Layout>);
}