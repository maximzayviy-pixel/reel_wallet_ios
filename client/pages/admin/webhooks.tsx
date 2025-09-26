import React from 'react';
import AdminGuard from '../../components/AdminGuard';
import AdminTable from '../../components/AdminTable';

export default function AdminWebhooks() {
  const [rows, setRows] = React.useState<any[]>([]);
  const [page, setPage] = React.useState(0);
  const pageSize = 50;
  const [loading, setLoading] = React.useState(false);
  const [total, setTotal] = React.useState<number|undefined>(undefined);

  const load = React.useCallback(async (p:number)=>{
    setLoading(true);
    const tg:any = (window as any).Telegram?.WebApp;
    const initData = tg?.initData || '';
    const r = await fetch('/api/admin/webhook-logs?limit='+pageSize+'&offset='+(p*pageSize), { headers: { 'x-telegram-init-data': initData } });
    const j = await r.json();
    setRows(j.rows || []);
    setTotal(j.total || undefined);
    setLoading(false);
  }, []);

  React.useEffect(()=>{ load(page); }, [page, load]);

  return (<AdminGuard>
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Webhook Logs</h1>
      <AdminTable rows={rows} page={page} pageSize={pageSize} total={total} loading={loading} onPageChange={setPage} />
    </div>
  </AdminGuard>);
}