"use client";
import { useEffect, useMemo, useState } from "react";

type Column<T> = {
  key: keyof T;
  title: string;
  render?: (row: T) => React.ReactNode;
};

type Props<T> = {
  fetchUrl: string;
  columns: Column<T>[];
  sortDefault?: string; // "created_at.desc"
  pageSize?: number;
};

export default function AdminTable<T extends Record<string, any>>({ fetchUrl, columns, sortDefault="created_at.desc", pageSize=20 }: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState(sortDefault);
  const [q, setQ] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(pageSize));
    p.set("offset", String(page*pageSize));
    p.set("sort", sort);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [page, pageSize, sort, q]);

  useEffect(() => {
    setLoading(true);
    fetch(`${fetchUrl}?${query}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((json) => {
        setRows(json.items || []);
        setTotal(json.total ?? (json.items?.length ?? 0));
        setError(null);
      })
      .catch((e:any) => setError(e?.message || "Ошибка"))
      .finally(() => setLoading(false));
  }, [fetchUrl, query]);

  const pages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <input value={q} onChange={e=>{setQ(e.target.value); setPage(0);}}
          placeholder="Поиск…" className="px-3 py-2 rounded-xl ring-1 ring-slate-300 text-sm flex-1" />
        <select value={sort} onChange={e=>{setSort(e.target.value); setPage(0);}}
          className="px-3 py-2 rounded-xl ring-1 ring-slate-300 text-sm">
          <option value="created_at.desc">Новые сначала</option>
          <option value="created_at.asc">Старые сначала</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>{columns.map(c => <th key={String(c.key)} className="text-left py-2 px-3">{c.title}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-4" colSpan={columns.length}>Загрузка…</td></tr>
            ) : error ? (
              <tr><td className="p-4 text-rose-600" colSpan={columns.length}>{error}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-4" colSpan={columns.length}>Пусто</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="border-t">
                {columns.map(col => <td key={String(col.key)} className="py-2 px-3">{col.render ? col.render(row) : String(row[col.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div>Всего: {total}</div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page<=0}
            className="px-3 py-1 rounded ring-1 ring-slate-300 disabled:opacity-40">Назад</button>
          <div>{page+1} / {pages}</div>
          <button onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page>=pages-1}
            className="px-3 py-1 rounded ring-1 ring-slate-300 disabled:opacity-40">Вперёд</button>
        </div>
      </div>
    </div>
  );
}
