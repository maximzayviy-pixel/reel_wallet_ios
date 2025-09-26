import { requireAdmin } from '../../../lib/requireAuth'
import { createClient } from '@supabase/supabase-js'

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!)

export default async function IncidentsPage() {
  await requireAdmin()
  const { data } = await service
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Инциденты</h2>
      <ul className="divide-y">
        {(data||[]).map((r:any) => (
          <li key={r.id} className="py-2 text-sm">
            <div className="font-mono">{r.created_at}</div>
            <div><b>{r.event}</b> • user: {r.target}</div>
            <pre className="bg-gray-50 rounded p-2 overflow-x-auto">{JSON.stringify(r.details, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </div>
  )
}
