// client/lib/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";

export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE!; // ⚠️ этот ключ добавь в Vercel
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}
