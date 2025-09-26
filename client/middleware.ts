import { NextResponse } from 'next/server'

// Gate /admin and /api/admin by presence of Supabase auth cookies.
// Optional Basic Auth fallback is controlled by env vars (handy during incidents).
export function middleware(req: Request) {
  const url = new URL(req.url)
  const path = url.pathname
  const isAdminArea = path.startsWith('/admin') || path.startsWith('/api/admin')

  if (!isAdminArea) return NextResponse.next()

  // (1) Optional Basic Auth (if both envs set)
  const USER = process.env.ADMIN_BASIC_USER
  const PASS = process.env.ADMIN_BASIC_PASS
  if (USER && PASS) {
    const auth = req.headers.get('authorization') || ''
    if (!auth.startsWith('Basic ')) return basic()
    const [u, p] = Buffer.from(auth.slice(6), 'base64').toString('utf8').split(':')
    if (u !== USER || p !== PASS) return basic()
  }

  // (2) Require Supabase auth cookies to be present
  const cookieHeader = (req as any).headers.get('cookie') || ''
  const hasSb = /(sb-.*-auth-token|sb-access-token|sb:token)/i.test(cookieHeader)
  if (!hasSb) {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.set('post_login_redirect', path, { path: '/', httpOnly: true })
    return res
  }

  return NextResponse.next()
}

function basic() {
  return new NextResponse('Auth required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="admin"' },
  })
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] }
