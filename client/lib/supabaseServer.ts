import { createClient } from "@supabase/supabase-js";

export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_KEY!; // 👈 именно так
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}
