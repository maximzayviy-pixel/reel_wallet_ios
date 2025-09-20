import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'METHOD_NOT_ALLOWED' });
  const { tg_id, code } = req.body || {};
  if(!tg_id || !code) return res.status(200).json({ ok:false, error:'BAD_INPUT' });
  const url = process.env.SUPABASE_URL!; const key = process.env.SUPABASE_SERVICE_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false }});
  const { data: pc, error } = await supabase.from('promocodes').select('*').eq('code', code).maybeSingle();
  if (error || !pc) return res.status(200).json({ ok:false, error: 'INVALID_CODE' });
  if (Number(pc.used||0) >= Number(pc.max_uses||0)) return res.status(200).json({ ok:false, error:'CODE_EXHAUSTED' });
  if (pc.currency === 'stars'){
    const { data: cur } = await supabase.from('balances').select('stars').eq('tg_id', tg_id).maybeSingle();
    const next = Number(cur?.stars||0) + Number(pc.bonus||0);
    await supabase.from('balances').upsert([{ tg_id, stars: next }], { onConflict: 'tg_id' });
  } else {
    const { data: cur } = await supabase.from('balances').select('ton').eq('tg_id', tg_id).maybeSingle();
    const next = Number(cur?.ton||0) + Number(pc.bonus||0);
    await supabase.from('balances').upsert([{ tg_id, ton: next }], { onConflict: 'tg_id' });
  }
  await supabase.from('promocode_usages').insert([{ code, tg_id }]);
  await supabase.from('promocodes').update({ used: Number(pc.used||0) + 1 }).eq('code', code);
  return res.status(200).json({ ok:true });
}