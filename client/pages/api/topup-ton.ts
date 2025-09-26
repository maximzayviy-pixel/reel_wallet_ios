import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './_adminAuth';
export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).end();
  // Ensure only authorised admins can top up TON
  if (!requireAdmin(req as any, res as any)) return;
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { user_id, amount_ton } = req.body || {};
  if(!user_id || !amount_ton) return res.status(400).json({ error: "user_id and amount_ton are required" });
  const rub = Number(amount_ton) * 300;
  await supabase.from('ledger').insert({ user_id, type:'topup_ton', amount_rub: rub, asset_amount: amount_ton, rate_used: 300, status:'done', metadata:{ source:'cryptocloud' } });
  await supabase.rpc('credit_user_balance', { p_user_id: user_id, p_amount: rub });
  await supabase.from('balances').update({ ton: (await supabase.from('balances').select('ton').eq('user_id', user_id).single()).data.ton + Number(amount_ton) }).eq('user_id', user_id);
  res.json({ success:true, rub });
}