// client/lib/admin.ts
import type { NextApiRequest } from "next";
import type { NextRequest } from "next/server";

export type AdminInfo = { id: number; via: "token" | "tg_id" };

function parseAdminIds(): Set<number> {
  const raw =
    process.env.TELEGRAM_ADMIN_IDS ||
    process.env.TELEGRAM_ADMIN_CHAT || // допускаем одиночный id
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

type NodeHeaders =
  | Headers
  | Record<string, string | string[] | undefined>;

function headerOf(h: NodeHeaders | undefined, name: string): string | undefined {
  if (!h) return undefined;
  if (typeof (h as Headers).get === "function") {
    // Headers (Edge / NextRequest / Request)
    return (h as Headers).get(name) ?? undefined;
  }
  // Node IncomingHttpHeaders (NextApiRequest.headers)
  const v = (h as Record<string, string | string[] | undefined>)[name];
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}

/** Общая проверка токена/allowlist */
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
    return { id: tgIdMaybe, via: "tg_id" };
  }
  return null;
}

/** Для pages API routes (NextApiRequest) */
export async function ensureIsAdminApi(req: NextApiRequest): Promise<AdminInfo> {
  const token = headerOf(req.headers as any, "x-admin-token");
  const tgHeader = headerOf(req.headers as any, "x-telegram-id");
  const tgQuery = (req.query?.tg_id as string | undefined) ?? undefined;
  const tgId = Number(tgHeader || tgQuery || 0) || undefined;

  const admin = checkAdminByHeadersAndId(token, tgId);
  if (admin) return admin;

  const err: any = new Error("Forbidden");
  err.statusCode = 403;
  throw err;
}

/** Для Edge/App Router (NextRequest/Request) — если понадобится */
export async function ensureIsAdminEdge(req: NextRequest | Request): Promise<AdminInfo> {
  const token = headerOf((req as any).headers, "x-admin-token");
  const tgHeader = headerOf((req as any).headers, "x-telegram-id");

  const urlStr = (req as any).url as string | undefined;
  const url = new URL(urlStr ?? "http://localhost");
  const tgQuery = url.searchParams.get("tg_id") ?? undefined;

  const tgId = Number(tgHeader || tgQuery || 0) || undefined;

  const admin = checkAdminByHeadersAndId(token, tgId);
  if (admin) return admin;

  const err: any = new Error("Forbidden");
  err.statusCode = 403;
  throw err;
}
