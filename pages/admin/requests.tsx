import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import { Check, X, Loader2, ImageIcon } from 'lucide-react'

type PR = {
  id: string
  tg_id: string
  amount_rub: number
  qr_payload: string
  image_url?: string|null
  status: string
  created_at: string
}

export default function AdminRequests() {
  const [rows, setRows] = useState<PR[]|null>(null)
  const [busy, setBusy] = useState<string|null>(null)
  const [err, setErr] = useState<string>('')

  async function load() {
    setErr('')
    try {
      const r = await fetch('/api/admin-list?status=pending')
      const j = await r.json()
      setRows(j.items || [])
    } catch (e:any) {
      setErr(e.message || 'error')
    }
  }

  useEffect(()=>{ load() }, [])

  const act = async (id: string, ok: boolean) => {
    try {
      setBusy(id)
      const path = ok ? '/api/admin-confirm' : '/api/admin-reject'
      const r = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'fail')
      await load()
    } catch (e:any) {
      alert(e.message || 'fail')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Layout title="Админ · Заявки">
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-xl font-semibold mb-3">Ожидающие заявки</h1>
        {err && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm mb-3">{err}</div>}
        {!rows && <div className="text-slate-500 text-sm">Загрузка…</div>}
        {rows?.length===0 && <div className="text-slate-500 text-sm">Пусто</div>}
        <div className="space-y-3">
          {rows?.map(r=> (
            <div key={r.id} className="bg-white rounded-2xl p-3 shadow-sm flex gap-3 items-start">
              <div className="w-24 h-24 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
                {r.image_url ? <img src={r.image_url} className="w-full h-full object-cover"/> : <ImageIcon className="text-slate-400" />}
              </div>
              <div className="flex-1">
                <div className="text-sm text-slate-500">{new Date(r.created_at).toLocaleString()}</div>
                <div className="font-semibold">Сумма: {r.amount_rub} ₽</div>
                <div className="text-xs text-slate-500 break-all">tg_id: {r.tg_id}</div>
                <div className="text-xs text-slate-500 break-all mt-1">{r.qr_payload}</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={()=>act(r.id, true)} disabled={busy===r.id}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs flex items-center gap-1 disabled:opacity-50">
                    {busy===r.id? <Loader2 className="animate-spin" size={14}/> : <Check size={14}/>} Подтвердить
                  </button>
                  <button onClick={()=>act(r.id, false)} disabled={busy===r.id}
                    className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs flex items-center gap-1 disabled:opacity-50">
                    {busy===r.id? <Loader2 className="animate-spin" size={14}/> : <X size={14}/>} Отклонить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
