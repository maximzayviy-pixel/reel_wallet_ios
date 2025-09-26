import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ADMIN_PATHS = ["/admin"];

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Apply only to /admin paths
  if (!ADMIN_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // If not in Telegram, block with pretty page
  const tgId = req.headers.get("x-telegram-user-id") || searchParams.get("tg_id");
  const inTelegram = req.headers.get("x-telegram-miniapp") === "1" || req.headers.get("sec-fetch-site") === "same-origin"; // soft signal
  if (!tgId || !inTelegram) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/forbidden";
    url.search = "";
    return NextResponse.rewrite(url, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
