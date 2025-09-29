import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin')) {
    const ok = req.cookies.get('tg_admin')?.value === '1';
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/forbidden';
      url.search = '';
      return NextResponse.rewrite(url, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };