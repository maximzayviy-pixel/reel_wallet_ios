
import React from 'react';
import AdminGuard from '../../components/AdminGuard';
import AdminTable from '../../components/AdminTable';

export default function AdminPromocodes() {
  const [rows, setRows] = React.useState<any[]>([]);
  const [code, setCode] = React.useState('');
  const [discount, setDiscount] = React.useState<number>(10);
  const [expires, setExpires] = React.useState<string>('');

  const [page, setPage] = React.useState(0);
  const pageSize = 50;
  const [loading, setLoading] = React.useState(false);

  const tg:any = (typeof window !== 'undefined') ? (window as any).Telegram?.WebApp : null;
  const initData = tg?.initData || '';

  const load = React.useCallback(async(p:number)=>{
    setLoading(true);
    const r = await fetch('/api/admin/promocodes/list?limit='+pageSize+'&offset='+(p*pageSize), { headers: {'x-telegram-init-data': initData} });
    const j = await r.json();
    setRows(j.rows || []);
    setLoading(false);
  }, [initData]);

  React.useEffect(()=>{ load(page); }, [page, load]);

  const create = async ()=>{
    await fetch('/api/admin/promocodes/create', { method:'POST', headers:{'Content-Type':'application/json','x-telegram-init-data': initData}, body: JSON.stringify({ code, discount, expires_at: expires || null }) });
    setCode(''); setDiscount(10); setExpires(''); load(page);
  };
  const toggle = async (c:string)=>{
    await fetch('/api/admin/promocodes/update', { method:'POST', headers:{'Content-Type':'application/json','x-telegram-init-data': initData}, body: JSON.stringify({ code: c, toggle:true }) });
    load(page);
  };
  const remove = async (c:string)=>{
    await fetch('/api/admin/promocodes/delete', { method:'POST', headers:{'Content-Type':'application/json','x-telegram-init-data': initData}, body: JSON.stringify({ code: c }) });
    load(page);
  };

  return (<AdminGuard>
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Promocodes</h1>

      <div className="bg-white rounded-2xl shadow p-4 mb-6">
        <h2 className="font-semibold mb-2">Создать промокод</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input value={code} onChange={e=>setCode(e.target.value)} placeholder="CODE10" className="border rounded px-3 py-2"/>
          <input value={discount} onChange={e=>setDiscount(parseInt(e.target.value,10)||0)} type="number" min="0" max="100" placeholder="Скидка %" className="border rounded px-3 py-2"/>
          <input value={expires} onChange={e=>setExpires(e.target.value)} type="datetime-local" className="border rounded px-3 py-2"/>
          <button onClick={create} className="px-4 py-2 rounded bg-black text-white">Создать</button>
        </div>
      </div>

      <AdminTable rows={rows} page={page} pageSize={pageSize} onPageChange={setPage} loading={loading} />
      <div className="mt-4 text-sm text-gray-600">Действия: щёлкни по строке — включить/выключить; значок 🗑 — удалить</div>

      <div className="mt-2">
        {rows.map((r:any)=>(
          <div key={r.code} className="flex items-center gap-2 py-1 text-sm">
            <button onClick={()=>toggle(r.code)} className="px-2 py-1 rounded bg-white shadow">{r.is_active?'Выключить':'Включить'}</button>
            <button onClick={()=>remove(r.code)} className="px-2 py-1 rounded bg-white shadow">🗑</button>
            <span className="font-mono">{r.code}</span>
            <span>-{r.discount}%</span>
            <span>{String(r.is_active)}</span>
            <span>{r.expires_at || ''}</span>
          </div>
        ))}
      </div>
    </div>
  </AdminGuard>);
}
