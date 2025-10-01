import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './admin/_guard';

export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).end();
  const admin = await requireAdmin(req, res);
  if(!admin) return;

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { user_id, amount_rub } = req.body;
  const { error } = await supabase.rpc('grant_bonus_balance', { p_user_id: user_id, p_amount: amount_rub });
  if(error) return res.status(400).json({ error });
  res.json({ success:true });
}