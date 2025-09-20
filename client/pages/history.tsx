import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Req = {
  id: string;
  status: "new" | "paid" | "rejected";
  amount_rub: number | null;
  max_limit_rub: number | null;
  created_at: string;
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function History() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const userId =
          (typeof window !== "undefined" &&
            (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString()) ||
          localStorage.getItem("user_id");
        if (!userId) return;
        const { data } = await supabase
          .from("payment_requests")
          .select("id,status,amount_rub,max_limit_rub,created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (mounted && data) setRows(data as any);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const ch = supabase
      .channel("pr-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_requests" },
        () => load()
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  if (loading) {
    return (
      <Layout title="История">
        <div className="max-w-md mx-auto p-4 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="История">
      <div className="max-w-md mx-auto p-4 space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="font-semibold">
                {r.status === "new" ? "⏳ В обработке" : r.status === "paid" ? "✅ Оплачено" : "❌ Отклонено"}
              </div>
              <div className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</div>
            </div>
            <div className="text-right font-semibold">
              {(r.amount_rub ?? r.max_limit_rub ?? 0).toFixed(2)} ₽
            </div>
          </div>
        ))}
        {!rows.length && <div className="text-center text-slate-500">Заявок пока нет</div>}
      </div>
    </Layout>
  );
}
