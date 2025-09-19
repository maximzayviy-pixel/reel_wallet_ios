"use client";
import Skeleton from '../components/Skeleton';
import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type Req = {
  id: string; status: string; amount_rub: number|null; max_limit_rub: number|null; created_at: string;
};

export default function History() {
  const [rows, setRows] = useState<Req[]>([]);

  useEffect(() => {
    const userId = (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString())
      || localStorage.getItem('user_id')
      || 'anonymous';

    const load = async () => {
      const { data } = await supabase
        .from('payment_requests')
        .select('id,status,amount_rub,max_limit_rub,created_at,user_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setRows((data as any) || []);
    };
    load();

    const ch = supabase
      .channel('realtime:payment_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests', filter: `user_id=eq.${userId}` }, (payload) => {
        load();
      }).subscribe();

    if(loading) return (<Layout title='История'><div className='max-w-md mx-auto p-4 space-y-3'><Skeleton className='h-6 w-full'/><Skeleton className='h-6 w-full'/><Skeleton className='h-6 w-full'/></div></Layout>);

return () => { supabase.removeChannel(ch); };
  }, []);

  if(loading) return (<Layout title='История'><div className='max-w-md mx-auto p-4 space-y-3'><Skeleton className='h-6 w-full'/><Skeleton className='h-6 w-full'/><Skeleton className='h-6 w-full'/></div></Layout>);

return (
    <Layout title="Reel Wallet — История">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-3">
        {rows.length === 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-slate-600">
            Нет заявок. Отсканируй QR, и здесь появится статус.
          </div>
        )}
        {rows.map(r => (
          <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="text-sm text-slate-500">Создано: {new Date(r.created_at).toLocaleString()}</div>
              <StatusBadge status={r.status} />
            </div>
            <div className="mt-2 text-lg font-semibold">
              {r.amount_rub || r.max_limit_rub || 0} ₽
            </div>
            {r.status === 'new' && (
              <div className="mt-2 text-sm text-slate-500 flex items-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full"></span>
                В ожидании оплаты админом…
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'paid') return <span className="text-green-700 bg-green-100 px-2 py-1 rounded-full text-xs">Оплачено ✅</span>;
  if (status === 'rejected') return <span className="text-red-700 bg-red-100 px-2 py-1 rounded-full text-xs">Отклонено ❌</span>;
  return <span className="text-slate-700 bg-slate-100 px-2 py-1 rounded-full text-xs">В обработке ⏳</span>;
}
