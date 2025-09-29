// client/lib/admin.ts
import type { NextApiRequest } from "next";
import type { NextRequest } from "next/server";

export type AdminInfo = { id: number; via: "token" | "tg_id" };

function parseAdminIds(): Set<number> {
  const raw =
    process.env.TELEGRAM_ADMIN_IDS ||
    process.env.TELEGRAM_ADMIN_CHAT || // на случай если используешь один чат как allowlist
    "";
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n))
  );
}

function headerOf(h: any, name: string): string | undefined {
  if (!h) return undefined;
  // NextApiRequest: req.headers['x-admin-token'] | NextRequest: req.headers.get(...)
  if (typeof h.get === "function") return h.get(name) ?? undefined;
  return (h[name] as string | undefined) ?? undefined;
}

/** Общая логика проверки токена/allowlist */
function checkAdminByHeadersAndId(
  tokenFromHeaders: string | undefined,
  tgIdMaybe: number | undefined
): AdminInfo | null {
  // 1) Секретный токен
  if (tokenFromHeaders && process.env.ADMIN_TOKEN && tokenFromHeaders === process.env.ADMIN_TOKEN) {
    return { id: 0, via: "token" };
  }
  // 2) tg_id из allowlist
  const allow = parseAdminIds();
  if (tgIdMaybe && allow.has(tgIdMaybe)) {
    return { id: tgIdMaybe, via: "tg_id" as const };
  }
  return null;
}

/** Для pages API routes (NextApiRequest) */
export async function ensureIsAdminApi(req: NextApiRequest): Promise<AdminInfo> {
  const token = headerOf(req.headers, "x-admin-token");
  const tgHeader = headerOf(req.headers, "x-telegram-id");
  const tgQuery = (req.query?.tg_id as string | undefined) ?? undefined;
  const tgId = Number(tgHeader || tgQuery || 0) || undefined;

  const admin = checkAdminByHeadersAndId(token, tgId);
  if (admin) return admin;

  const err: any = new Error("Forbidden");
  err.statusCode = 403;
  throw err;
}

/** Для Edge/App Router (NextRequest/Request) — если пригодится */
export async function ensureIsAdminEdge(req: NextRequest | Request): Promise<AdminInfo> {
  // @ts-expect-error — у Request/NextRequest есть headers.get
  const token = headerOf(req.headers, "x-admin-token");
  // @ts-expect-error
  const tgHeader = headerOf(req.headers, "x-telegram-id");

  // Из URL можно достать tg_id как query-параметр
  const url = new URL((req as any).url ?? "http://localhost");
  const tgQuery = url.searchParams.get("tg_id") ?? undefined;

  const tgId = Number(tgHeader || tgQuery || 0) || undefined;

  const admin = checkAdminByHeadersAndId(token, tgId);
  if (admin) return admin;

  const err: any = new Error("Forbidden");
  err.statusCode = 403;
  throw err;
}
