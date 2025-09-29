import { createClient } from '@supabase/supabase-js';
import { notifyUser } from './_notify';
import { requireAdmin } from './admin/_guard';

export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).end();
  const admin = await requireAdmin(req, res);
  if(!admin) return;

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { request_id } = req.body;
  const { data, error } = await supabase.from('payment_requests')
    .update({ status:'rejected', admin_id: admin.tg_id ?? null })
    .eq('id', request_id).select();
  if(error) return res.status(400).json({ error });
  res.json({ success:true, request:data[0] });
}