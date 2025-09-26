
import { NextResponse, NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin')) {
    const hasSession = req.cookies.get('tg_admin')?.value === '1';
    if (!hasSession) {
      return new NextResponse(
        `<!doctype html>
         <html lang="ru"><head><meta charset="utf-8"/>
         <meta name="viewport" content="width=device-width,initial-scale=1"/>
         <title>Доступ запрещён</title>
         <style>
           body{margin:0;background:#f6f7fb;font-family:ui-sans-serif,system-ui}
           .c{min-height:100vh;display:flex;align-items:center;justify-content:center}
           .b{background:#fff;padding:32px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.06);text-align:center;max-width:480px}
           h1{margin:0 0 8px;font-size:24px}
           p{margin:0 0 16px;color:#475569}
           ol{margin:0;padding-left:18px;color:#475569;text-align:left}
         </style></head><body>
         <div class="c"><div class="b">
         <h1>Доступ запрещён</h1>
         <p>Эта страница доступна только администраторам и только из Telegram.</p>
         <ol>
           <li>Откройте нашего Telegram-бота.</li>
           <li>Нажмите «Открыть админку».</li>
         </ol>
         </div></div></body></html>`,
        { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
