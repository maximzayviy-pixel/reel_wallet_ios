import { createClient } from '@supabase/supabase-js';
export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).end();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { user_id, amount_ton } = req.body || {};
  if(!user_id || !amount_ton) return res.status(400).json({ error: "user_id and amount_ton are required" });
  const rub = Number(amount_ton) * 300;
  await supabase.from('ledger').insert({ user_id, type:'topup_ton', amount_rub: rub, asset_amount: amount_ton, rate_used: 300, status:'done', metadata:{ source:'cryptocloud' } });
  await supabase.rpc('credit_user_balance', { p_user_id: user_id, p_amount: rub });
  res.json({ success:true, rub });
}