"use client";
import Layout from "../../components/Layout";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PaymentPage() {
  const router = useRouter();
  const { id } = router.query;
  const [status, setStatus] = useState<string>("new");
  const [amount, setAmount] = useState<number|null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase.from("payment_requests").select("*").eq("id", id).single();
      if (data) { setStatus(data.status); setAmount(data.amount_rub || data.max_limit_rub); }
    };
    load();
    const ch = supabase.channel("pr-" + id)
      .on("postgres_changes", { event:"*", schema:"public", table:"payment_requests", filter:`id=eq.${id}` }, (payload)=>{ load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  return (
    <Layout title="Reel Wallet — Оплата">
      <div className="max-w-md mx-auto px-4 pt-12 text-center">
        <div className="text-2xl font-bold mb-4">Статус оплаты</div>
        <div className="text-4xl mb-6">{amount ? amount + " ₽" : ""}</div>
        {status === "new" && <div className="text-slate-600"><span className="animate-spin inline-block w-6 h-6 border-4 border-slate-300 border-t-transparent rounded-full mr-2"></span>Ожидание оплаты…</div>}
        {status === "paid" && <div className="text-green-600 text-xl">✅ Оплачено</div>}
        {status === "rejected" && <div className="text-red-600 text-xl">❌ Отклонено</div>}
      </div>
    </Layout>
  );
}
