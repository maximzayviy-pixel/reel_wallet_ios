// client/lib/sendTransfer.ts
// Use either Supabase session token or Telegram initData header.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, anonKey);

declare global {
  interface Window {
    Telegram?: any;
  }
}

export async function sendTransfer(to_tg_id: number, amount_stars: number, note?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // Prefer Supabase session if logged in
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  else if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
    // Fallback to Telegram WebApp initData
    headers["X-Telegram-Init-Data"] = window.Telegram.WebApp.initData;
  }

  const resp = await fetch("/api/transfer-stars", {
    method: "POST",
    headers,
    body: JSON.stringify({ to_tg_id, amount_stars, note }),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error || "Transfer failed");
  return json;
}
