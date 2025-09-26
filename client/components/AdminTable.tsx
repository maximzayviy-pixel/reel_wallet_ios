
// client/components/AdminTable.tsx
import React from 'react';

type SortState = { key: string; dir: 'asc'|'desc' };
type Props = {
  rows: any[];
  loading?: boolean;
  page: number;
  pageSize: number;
  total?: number;
  onPageChange: (p: number) => void;
  onRequestSort?: (key: string, dir: 'asc'|'desc') => void;
};

export default function AdminTable({ rows, loading, page, pageSize, total, onPageChange, onRequestSort }: Props) {
  if (!rows || rows.length === 0) return <div className="p-4 text-gray-500">{loading?'Загрузка…':'Нет данных'}</div>;
  const headers = Object.keys(rows[0]);
  const pages = Math.max(1, Math.ceil((total ?? rows.length) / pageSize));

  const handleSort = (key: string) => {
    if (!onRequestSort) return;
    // naive toggle for demo
    onRequestSort(key, 'asc');
  };

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600">
            {headers.map(h => (
              <th key={h} className="px-3 py-2 border-b cursor-pointer select-none" onClick={() => handleSort(h)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i} className="odd:bg-gray-50">
              {headers.map(k => <td key={k} className="px-3 py-2 border-b">{String(r[k])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between mt-3">
        <div className="text-gray-500 text-sm">Стр. {page+1} из {pages}</div>
        <div className="flex gap-2">
          <button disabled={page<=0} onClick={()=>onPageChange(0)} className="px-3 py-1 rounded bg-white shadow disabled:opacity-50">«</button>
          <button disabled={page<=0} onClick={()=>onPageChange(page-1)} className="px-3 py-1 rounded bg-white shadow disabled:opacity-50">‹</button>
          <button disabled={page>=pages-1} onClick={()=>onPageChange(page+1)} className="px-3 py-1 rounded bg-white shadow disabled:opacity-50">›</button>
          <button disabled={page>=pages-1} onClick={()=>onPageChange(pages-1)} className="px-3 py-1 rounded bg-white shadow disabled:opacity-50">»</button>
        </div>
      </div>
    </div>
  );
}
