// middleware.ts
// Optional: server-side guard for /admin by Telegram user.id.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function parseAdminIds(src?: string): string[] {
  if (!src) return [];
  return src.split(",").map(s => s.trim()).filter(Boolean);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // Try to read tgId from a header set by the client (e.g., X-Telegram-Id),
  // or from a cookie set by your login flow.
  const tgId = req.headers.get("x-telegram-id") || req.cookies.get("tg_id")?.value;
  if (!tgId) return NextResponse.next(); // allow, UI will still hide if not admin

  const adminIds = parseAdminIds(process.env.NEXT_PUBLIC_ADMIN_IDS);
  const isAdmin = adminIds.includes(String(tgId));
  if (!isAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
