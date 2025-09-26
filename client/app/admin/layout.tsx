import { requireAdmin }  from '../../lib/requireAuth'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin()
  } catch (e: any) {
    if (e.message === 'UNAUTHENTICATED') {
      return <meta httpEquiv="refresh" content="0; url=/login" />
    }
    return <div style={{ padding: 24 }}>Forbidden</div>
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Админка</h1>
        <nav className="space-x-4 text-sm">
          <Link href="/admin/users">Пользователи</Link>
          <Link href="/admin/incidents">Инциденты</Link>
        </nav>
      </header>
      {children}
    </div>
  )
}
