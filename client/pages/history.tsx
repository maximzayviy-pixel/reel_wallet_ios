// pages/history.tsx
import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";
import { useEffect, useMemo, useState } from "react";
import useBanRedirect from '../lib/useBanRedirect';
import { createClient } from "@supabase/supabase-js";

type PR = {
  id: string;
  status: "new" | "pending" | "paid" | "rejected";
  amount_rub: number | null;
  max_limit_rub: number | null;
  created_at: string;
  qr_payload?: string | null;
};

type LRow = {
  id: string;
  type?: "p2p_send" | "p2p_recv" | null;
  asset_amount: number;
  amount_rub: number | null;
  created_at: string;
  metadata: any;
};

type Item =
  | {
      kind: "sbp";
      id: string;
      created_at: string;
      status: PR["status"];
      rub: number;
      stars: number;
      qr?: string | null;
    }
  | {
      kind: "p2p";
      id: string; // ledger id
      created_at: string;
      direction: "out" | "in";
      rub: number;
      stars: number;
      transfer_id?: string;
    };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function History() {
  // Redirect banned users
  useBanRedirect();
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // модалка-чек
  const [modal, setModal] = useState<null | { type: "sbp" | "p2p"; data: any }>(null);

  const tg: any = useMemo(
    () => (typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null),
    []
  );

  const load = async () => {
    try {
      const tgId =
        tg?.initDataUnsafe?.user?.id ||
        (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;

      if (!tgId) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 1) заявки по СБП
      const prq = supabase
        .from("payment_requests")
        .select("id,status,amount_rub,max_limit_rub,created_at,qr_payload")
        .eq("tg_id", tgId)
        .order("created_at", { ascending: false })
        .limit(100);

      // 2) p2p из ledger — берём по типу ИЛИ по наличию transfer_id
      const lq = supabase
        .from("ledger")
        .select("id,type,asset_amount,amount_rub,created_at,metadata")
        .eq("tg_id", tgId)
        .or("type.in.(p2p_send,p2p_recv),metadata->>transfer_id.not.is.null")
        .order("created_at", { ascending: false })
        .limit(100);

      const [{ data: pr }, { data: led }] = await Promise.all([prq, lq]);

      const sbpItems: Item[] =
        (pr || []).map((r: PR) => {
          const rub = Number(r.amount_rub ?? r.max_limit_rub ?? 0);
          const st = (r.status ?? "pending") as PR["status"];
          return {
            kind: "sbp",
            id: r.id,
            created_at: r.created_at,
            status: st,
            rub,
            stars: Math.round(rub * 2),
            qr: r.qr_payload || null,
          };
        }) || [];

      const p2pItems: Item[] =
        (led || []).map((r: LRow) => {
          const dir: "out" | "in" = Number(r.asset_amount) < 0 ? "out" : "in";
          const stars = Math.abs(Number(r.asset_amount || 0));
          const rub = Math.abs(Number(r.amount_rub || 0));
          const transfer_id =
            (r?.metadata && (r.metadata as any)?.transfer_id) || undefined;

          return {
            kind: "p2p",
            id: r.id,
            created_at: r.created_at,
            direction: dir,
            stars,
            rub,
            transfer_id,
          };
        }) || [];

      // объединяем и сортируем
      const all = [...sbpItems, ...p2pItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRows(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    // realtime: заявки СБП
    const ch1 = supabase
      .channel("pr-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_requests" },
        () => load()
      )
      .subscribe();

    // realtime: только p2p-движения в ledger
    const ch2 = supabase
      .channel("ledger-p2p-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ledger" },
        (p: any) => {
          const t = p?.new?.type as string | undefined;
          const hasTransferId = !!p?.new?.metadata?.transfer_id;
          if (t === "p2p_send" || t === "p2p_recv" || hasTransferId) {
            load();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openReceipt = async (it: Item) => {
    if (it.kind === "sbp") {
      setModal({ type: "sbp", data: it });
      return;
    }
    // P2P — дотягиваем контрагента и детали (если есть transfer_id)
    try {
      const q = it.transfer_id
        ? `/api/transfer-info?transfer_id=${encodeURIComponent(it.transfer_id)}`
        : null;
      let info: any = null;
      if (q) {
        const r = await fetch(q);
        info = await r.json().catch(() => null);
      }
      setModal({
        type: "p2p",
        data: { ...it, details: info?.ok ? info : null },
      });
    } catch {
      setModal({ type: "p2p", data: it });
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { hour12: false });

  return (
    <Layout title="История">
      <div className="max-w-md mx-auto p-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : rows.length ? (
          <div className="space-y-3">
            {rows.map((r, i) =>
              r.kind === "sbp" ? (
                <button
                  key={`sbp-${r.id}-${i}`}
                  onClick={() => openReceipt(r)}
                  className="w-full text-left bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold">
                      {r.status === "paid"
                        ? "✅ Оплачено (СБП)"
                        : r.status === "rejected"
                        ? "❌ Отклонено (СБП)"
                        : "⏳ Ожидаем оплату (СБП)"}
                    </div>
                    <div className="text-xs text-slate-500">{fmt(r.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{r.rub.toFixed(2)} ₽</div>
                    <div className="text-xs text-slate-500">{r.stars} ⭐</div>
                  </div>
                </button>
              ) : (
                <button
                  key={`p2p-${r.id}-${i}`}
                  onClick={() => openReceipt(r)}
                  className="w-full text-left bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold">
                      {r.direction === "out" ? "⬆️ Перевод отправлен" : "⬇️ Перевод получен"}
                    </div>
                    <div className="text-xs text-slate-500">{fmt(r.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-semibold ${
                        r.direction === "out" ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {r.direction === "out" ? "-" : "+"}
                      {r.stars} ⭐
                    </div>
                    <div className="text-xs text-slate-500">{r.rub.toFixed(2)} ₽</div>
                  </div>
                </button>
              )
            )}
          </div>
        ) : (
          <div className="text-center text-slate-500">История пуста</div>
        )}
      </div>

      {/* Модалка-чек */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-md mx-auto p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Чек</div>
              <button
                className="text-slate-500 text-sm"
                onClick={() => setModal(null)}
              >
                Закрыть ✕
              </button>
            </div>

            {modal.type === "p2p" ? (
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="text-slate-500">Тип:</span>{" "}
                  {modal.data.direction === "out" ? "Перевод отправлен" : "Перевод получен"}
                </div>
                <div className="text-3xl font-bold">
                  {modal.data.direction === "out" ? "-" : "+"}
                  {modal.data.stars} ⭐
                </div>
                <div className="text-slate-500 text-sm">
                  (~ {modal.data.rub.toFixed(2)} ₽)
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mt-2">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-[11px] text-slate-500">Время</div>
                    <div className="font-medium">{fmt(modal.data.created_at)}</div>
                  </div>
                  {modal.data.transfer_id && (
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-[11px] text-slate-500">Transfer ID</div>
                      <div className="font-mono text-[12px] break-all">
                        {modal.data.transfer_id}
                      </div>
                    </div>
                  )}

                  {modal.data.details?.ok && (
                    <>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <div className="text-[11px] text-slate-500">Отправитель</div>
                        <div className="font-medium">{modal.data.details.from_tg_id}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <div className="text-[11px] text-slate-500">Получатель</div>
                        <div className="font-medium">{modal.data.details.to_tg_id}</div>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setModal(null)}
                  className="mt-4 w-full rounded-xl bg-slate-900 text-white py-2"
                >
                  Понятно
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="text-slate-500">Статус:</span>{" "}
                  {modal.data.status === "paid"
                    ? "Оплачено"
                    : modal.data.status === "rejected"
                    ? "Отклонено"
                    : "Ожидаем оплату"}
                </div>
                <div className="text-3xl font-bold">{modal.data.rub.toFixed(2)} ₽</div>
                <div className="text-slate-500 text-sm">({modal.data.stars} ⭐)</div>

                <div className="grid grid-cols-2 gap-3 text-sm mt-2">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-[11px] text-slate-500">Создано</div>
                    <div className="font-medium">{fmt(modal.data.created_at)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-[11px] text-slate-500">ID заявки</div>
                    <div className="font-mono text-[12px] break-all">{modal.data.id}</div>
                  </div>
                  {modal.data.qr && (
                    <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                      <div className="text-[11px] text-slate-500">QR payload</div>
                      <div className="font-mono text-[12px] break-all">{modal.data.qr}</div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setModal(null)}
                  className="mt-4 w-full rounded-xl bg-slate-900 text-white py-2"
                >
                  ОК
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
