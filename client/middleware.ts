import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

export function middleware(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('tma ')) {
    const isApi = req.nextUrl.pathname.startsWith('/api/');
    if (isApi) {
      return new NextResponse(JSON.stringify({ ok: false, error: 'FORBIDDEN' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }
    return NextResponse.redirect(new URL('/403', req.url));
  }
  return NextResponse.next();
}
