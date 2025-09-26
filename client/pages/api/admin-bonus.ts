import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './_adminAuth';
export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).end();
  // Only allow authorised admins to grant bonus stars
  if (!requireAdmin(req, res)) return;
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { user_id, amount_rub } = req.body;
  const { error } = await supabase.rpc('grant_bonus_balance', { p_user_id: user_id, p_amount: amount_rub });
  if(error) return res.status(400).json({ error });
  res.json({ success:true });
}