import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'METHOD_NOT_ALLOWED' });
  const { code, bonus, currency, max_uses } = req.body||{};
  if(!code || !bonus || !currency || !max_uses) return res.status(200).json({ ok:false, error:'BAD_INPUT' });
  const adminId = String(process.env.ADMIN_TG_ID || process.env.TELEGRAM_ADMIN_CHAT || "");
  const fromId  = String(req.headers['x-reel-admin-id'] || "");
  if (!adminId || (fromId && fromId !== adminId)) return res.status(200).json({ ok:false, error:'FORBIDDEN' });
  const url = process.env.SUPABASE_URL!; const key = process.env.SUPABASE_SERVICE_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false }});
  const { error } = await supabase.from('promocodes').insert([{ code, bonus, currency, max_uses }]);
  if (error) return res.status(200).json({ ok:false, error: error.message });
  return res.status(200).json({ ok:true });
}