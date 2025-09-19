import { createClient } from '@supabase/supabase-js';
export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).end();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { request_id, paid_amount_rub, admin_id } = req.body;
  const { data, error } = await supabase.from('payment_requests')
    .update({ status:'paid', paid_amount_rub, admin_id, paid_at:new Date() })
    .eq('id', request_id).select();
  if(error) return res.status(400).json({ error });
  const reqRow = data[0];
  await supabase.rpc('debit_user_balance', { p_user_id: reqRow.user_id, p_amount: paid_amount_rub });
  res.json({ success:true, request:reqRow });
}