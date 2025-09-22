// pages/payment/[id].tsx
import Layout from "../../components/Layout";
import Link from "next/link";
import { useRouter } from "next/router";
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
  qr_payload?: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const rouble = (n: number) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
const stars = (n: number) => `${n.toLocaleString("ru-RU")} ⭐`;
const copy = async (t: string) => {
  try { await navigator.clipboard.writeText(t); } catch {}
};

const statusMeta = {
  pending:  { label: "Ожидаем оплату", pill: "bg-amber-50 text-amber-700 ring-amber-200",   emoji: "⏳" },
  paid:     { label: "Оплачено",       pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", emoji: "✅" },
  rejected: { label: "Отклонено",      pill: "bg-rose-50 text-rose-700 ring-rose-200",      emoji: "❌" },
} as const;

function normStatus(r: Req): keyof typeof statusMeta {
  if (r.paid_at) return "paid";
  if (String(r.status) === "rejected") return "rejected";
  return "pending";
}

export default function PaymentDetails() {
  const { query, back } = useRouter();
  const id = useMemo(() => String(query.id ?? ""), [query.id]);

  const [row, setRow] = useState<Req | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    const load = async () => {
      const { data } = await supabase
        .from("payment_requests")
        .select("id,tg_id,status,amount_rub,max_limit_rub,created_at,paid_at,image_url,qr_payload")
        .eq("id", id)
        .maybeSingle();
      if (mounted) setRow((data as any) ?? null);
    };
    load();

    const ch = supabase
      .channel(`pr-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_requests", filter: `id=eq.${id}` },
        () => load()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [id]);

  const amountRub = row ? (row.amount_rub ?? row.max_limit_rub ?? 0) : 0;
  const amountStars = Math.round(amountRub * 2);
  const s = row ? statusMeta[normStatus(row)] : statusMeta.pending;

  return (
    <Layout title="Заявка">
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => back()}
            className="rounded-xl px-3 py-2 ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50"
          >
            ← Назад
          </button>
          <div className={`px-2.5 py-1 text-xs font-medium rounded-full ring-1 ${s.pill}`}>
            {s.emoji} {s.label}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-slate-500">Сумма</div>
              <div className="text-2xl font-semibold">{rouble(amountRub)}</div>
              <div className="text-xs text-slate-500">{stars(amountStars)}</div>
            </div>
            {row?.image_url ? (
              <a
                href={row.image_url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl overflow-hidden ring-1 ring-slate-200"
                title="Открыть QR"
              >
                {/* превью QR */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={row.image_url} alt="QR" className="w-24 h-24 object-cover" />
              </a>
            ) : null}
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Создано</span>
              <span>{row ? new Date(row.created_at).toLocaleString() : "—"}</span>
            </div>
            {row?.paid_at && (
              <div className="flex justify-between">
                <span className="text-slate-500">Оплачено</span>
                <span>{new Date(row.paid_at).toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">ID заявки</span>
              <button
                className="truncate text-xs font-mono px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200"
                onClick={() => row && copy(row.id)}
                title="Скопировать"
              >
                {row?.id ?? "—"}
              </button>
            </div>
            {row?.qr_payload && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">QR payload</span>
                <button
                  className="truncate text-xs font-mono px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200"
                  onClick={() => copy(row.qr_payload!)}
                  title="Скопировать"
                >
                  {row.qr_payload}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-slate-500">
          Получатель — Reel Wallet. После оплаты статус обновится автоматически.
        </div>

        <div className="text-center">
          <Link
            href="/history"
            className="inline-block rounded-xl px-4 py-2 ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Вернуться к истории
          </Link>
        </div>
      </div>
    </Layout>
  );
}
