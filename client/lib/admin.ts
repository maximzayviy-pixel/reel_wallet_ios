import type { NextRequest } from "next/server";

export function readTgId(req: Request | NextRequest): string | null {
  try {
    // Prefer header set by the Mini App frontend
    const h = (req as any).headers?.get?.("x-telegram-user-id") || (req as any).headers?.get?.("X-Telegram-User-Id");
    if (h) return String(h);
  } catch {}
  try {
    // Fallback: query param for local tests
    const url = new URL((req as any).url ?? "");
    const tg = url.searchParams.get("tg_id");
    if (tg) return String(tg);
  } catch {}
  return null;
}

export async function ensureIsAdmin(req: Request | NextRequest): Promise<{ tgId: string }> {
  const tgId = readTgId(req);
  if (!tgId) {
    throw new Response(JSON.stringify({ ok: false, error: "NO_TG_ID" }), { status: 401 });
  }
  // Fast env override
  const envAdmins = (process.env.NEXT_PUBLIC_ADMINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (envAdmins.includes(String(tgId))) return { tgId: String(tgId) };
  // DB check
  const { supabaseAdmin } = await import("./supabaseAdmin");
  const { data, error } = await supabaseAdmin.from("users").select("role").eq("tg_id", tgId).maybeSingle();
  if (error) {
    throw new Response(JSON.stringify({ ok: false, error: "DB_ERROR", details: error.message }), { status: 500 });
  }
  if (!data || (data.role ?? "user") !== "admin") {
    throw new Response(JSON.stringify({ ok: false, error: "FORBIDDEN" }), { status: 403 });
  }
  return { tgId: String(tgId) };
}
