import { createClient } from '@supabase/supabase-js';
export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).end();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { user_id, stars } = req.body || {};
  if(!user_id || stars === undefined) return res.status(400).json({ error: "user_id and stars are required" });
  const rub = Number(stars) / 2;
  await supabase.from('ledger').insert({ user_id, type:'topup_stars', amount_rub: rub, asset_amount: stars, rate_used: 0.5, status:'done', metadata:{ source:'telegram_iap' } });
  await supabase.rpc('credit_user_balance', { p_user_id: user_id, p_amount: rub });
  res.json({ success:true, rub });
}