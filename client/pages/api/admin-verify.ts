import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './_adminAuth';
export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).end();
  // Verification is an admin operation
  if (!requireAdmin(req, res)) return;
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { user_id } = req.body;
  const { data, error } = await supabase.from('users').update({ is_verified:true }).eq('id', user_id).select();
  if(error) return res.status(400).json({ error });
  res.json({ success:true, user:data[0] });
}