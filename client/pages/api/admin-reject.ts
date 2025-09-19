import { createClient } from '@supabase/supabase-js';
import { notifyUser } from './_notify';

export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).end();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { request_id, admin_id } = req.body;
  const { data, error } = await supabase.from('payment_requests')
    .update({ status:'rejected', admin_id })
    .eq('id', request_id).select();
  if(error) return res.status(400).json({ error });
  res.json({ success:true, request:data[0] });
}