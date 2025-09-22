// pages/history.tsx
import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Req = {
  id: string;
  tg_id: number | null;
  status: "new" | "pending" | "paid" | "rejected" | string;
  amount_rub: number | null;
  max_limit_rub: number | null;
  created_at: string;
  paid_at: string | null;
  image_url?: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const rouble = (n: number) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
const stars = (n: number) => `${n.toLocaleString("ru-RU")} ⭐`;

// если paid_at проставлен — считаем оплачено, даже если status = pending/new
function normalizeStatus(r: Req): "paid" | "rejected" | "pending" {
  if (r.paid_at) return "paid";
  if (String(r.status) === "rejected") return "rejected";
  return "pending";
}
const statusMeta: Record<"paid" | "rejected" | "pending", { label: string; pill: string; emoji: string }> = {
  pending:  { label: "Ожидаем оплату", pill: "bg-amber-50 text-amber-700 ring-amber-200",   emoji: "⏳" },
  paid:     { label: "Оплачено",       pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", emoji: "✅" },
  rejected: { label: "Отклонено",      pill: "bg-rose-50 text-rose-700 ring-rose-200",      emoji: "❌" },
};

function detectTgId(): number | null {
  try {
    const fromTg =
      typeof window !== "undefined" &&
      (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (fromTg) return Number(fromTg);
    const ls1 = typeof window !== "undefined" ? localStorage.getItem("tg_id") : null;
    const ls2 = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
    if (ls1 && /^\d+$/.test(ls1)) return Number(ls1);
    if (ls2 && /^\d+$/.test(ls2)) return Number(ls2);
    const u = typeof window !== "undefined" ? new URL(window.location.href) : null;
    const q = u?.searchParams.get("tg_id") || u?.searchParams.get("tg");
    if (q && /^\d+$/.test(q)) return Number(q);
  } catch {}
  return null;
}

export default function History() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = useMemo(detectTgId, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const base = supabase
          .from("payment_requests")
          .select("id,tg_id,status,amount_rub,max_limit_rub,created_at,paid_at,image_url")
          .order("created_at", { ascending: false })
          .limit(100);

        const { data, error } = userId ? await base.eq("tg_id", userId) : await base;
        if (!error && mounted) {
          const list = (data || []) as Req[];
          setRows(userId ? list.filter((r) => Number(r.tg_id) === Number(userId)) : list);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    const ch = supabase
      .channel(`pr-list-${userId ?? "all"}`)
      .on(
        "postgres_changes",
        userId
          ? { event: "*", schema: "public", table: "payment_requests", filter: `tg_id=eq.${userId}` }
          : { event: "*", schema: "public", table: "payment_requests" },
        () => load()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [userId]);

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
        {!rows.length && (
          <div className="text-center text-slate-500 py-12">
            🗒️ Заявок пока нет
          </div>
        )}

        {rows.map((r) => {
          const s = normalizeStatus(r);
          const meta = statusMeta[s];
          const amountRub = (r.amount_rub ?? r.max_limit_rub ?? 0);
          const amountStars = Math.round(amountRub * 2);
          const when = r.paid_at ?? r.created_at;

          return (
            <Link
              key={r.id}
              href={`/payment/${r.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 hover:ring-slate-200 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ring-1 ${meta.pill}`}>
                      {meta.emoji} {meta.label}
                    </span>
                    <span className="text-xs text-slate-400 truncate">
                      {new Date(when).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500">
                    Оплата по СБП • заявка #{r.id.slice(0, 8)}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-semibold">{rouble(amountRub)}</div>
                  <div className="text-xs text-slate-500">{stars(amountStars)}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Layout>
  );
}
