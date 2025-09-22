// pages/history.tsx
import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Req = {
  id: string;
  tg_id: number | null;
  status: "new" | "pending" | "paid" | "rejected";
  amount_rub: number | null;
  max_limit_rub: number | null;
  created_at: string;
  paid_at: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const rouble = (n: number) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
const stars = (n: number) => `${n.toLocaleString("ru-RU")} ⭐`;

const statusMeta: Record<
  NonNullable<Req["status"]>,
  { label: string; className: string; emoji: string }
> = {
  new:      { label: "Ожидаем оплату", className: "bg-amber-50 text-amber-700 ring-amber-200", emoji: "⏳" },
  pending:  { label: "Ожидаем оплату", className: "bg-amber-50 text-amber-700 ring-amber-200", emoji: "⏳" },
  paid:     { label: "Оплачено",       className: "bg-emerald-50 text-emerald-700 ring-emerald-200", emoji: "✅" },
  rejected: { label: "Отклонено",      className: "bg-rose-50 text-rose-700 ring-rose-200", emoji: "❌" },
};

function detectTgId(): number | null {
  try {
    // 1) Telegram WebApp
    const fromTg =
      typeof window !== "undefined" &&
      (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (fromTg) return Number(fromTg);

    // 2) localStorage (оба ключа на всякий случай)
    const ls1 = typeof window !== "undefined" ? localStorage.getItem("tg_id") : null;
    const ls2 = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
    if (ls1 && /^\d+$/.test(ls1)) return Number(ls1);
    if (ls2 && /^\d+$/.test(ls2)) return Number(ls2);

    // 3) query (?tg_id= / ?tg=)
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      const q1 = u.searchParams.get("tg_id");
      const q2 = u.searchParams.get("tg");
      if (q1 && /^\d+$/.test(q1)) return Number(q1);
      if (q2 && /^\d+$/.test(q2)) return Number(q2);
    }
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
        // берём 100 последних; если знаем tg_id — фильтруем на запросе, иначе отфильтруем на клиенте
        const q = supabase
          .from("payment_requests")
          .select("id,tg_id,status,amount_rub,max_limit_rub,created_at,paid_at")
          .order("created_at", { ascending: false })
          .limit(100);

        const { data, error } = userId ? await q.eq("tg_id", userId) : await q;
        if (error) {
          console.warn("history load error:", error);
          return;
        }
        let list = (data || []) as Req[];

        // запасной фильтр по tg_id на клиенте, если он известен
        if (userId) list = list.filter((r) => Number(r.tg_id) === Number(userId));

        if (mounted) setRows(list);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    // Realtime: если знаем tg_id — слушаем только его; иначе общий канал
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

  const Empty = () => (
    <div className="max-w-md mx-auto p-8 text-center">
      <div className="text-3xl mb-2">🗒️</div>
      <div className="font-semibold mb-1">Заявок пока нет</div>
      <div className="text-sm text-slate-500">
        Сканируй QR СБП во вкладке «Сканер», чтобы создать первую заявку.
      </div>
    </div>
  );

  return (
    <Layout title="История">
      <div className="max-w-md mx-auto p-4 space-y-3">
        {!rows.length && <Empty />}

        {rows.map((r) => {
          const status = statusMeta[r.status] ?? statusMeta.new;
          const amountRub = (r.amount_rub ?? r.max_limit_rub ?? 0);
          const amountStars = Math.round(amountRub * 2); // курс 2⭐ = 1₽
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
                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded-full ring-1 ${status.className}`}
                    >
                      {status.emoji} {status.label}
                    </span>
                    <span className="text-xs text-slate-400 truncate">
                      {new Date(when).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-sm text-slate-500">
                    Оплата по СБП • получатель — админ
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
