import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'METHOD_NOT_ALLOWED' });
  const tg_id = Number(req.query.tg_id||0);
  if(!tg_id) return res.status(200).json({ ok:true, items: [] });
  const url = process.env.SUPABASE_URL!; const key = process.env.SUPABASE_SERVICE_KEY!;
  if(!url || !key) return res.status(200).json({ ok:true, items: [] });
  const supabase = createClient(url, key, { auth: { persistSession: false }});
  const { data, error } = await supabase
    .from('ledger')
    .select('id,type,amount,amount_rub,created_at,status')
    .eq('tg_id', tg_id)
    .order('created_at',{ascending:false})
    .limit(100);
  if (error) return res.status(200).json({ ok:false, error: error.message });
  return res.status(200).json({ ok:true, items: data||[] });
}