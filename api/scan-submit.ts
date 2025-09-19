import { createClient } from '@supabase/supabase-js';
import { notifyUser } from './_notify';

export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).end();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { user_id, qr_payload, qr_image_url, amount_rub, max_limit_rub } = req.body;
  const { data, error } = await supabase.from('payment_requests').insert([{
    user_id, qr_payload, qr_image_url, amount_rub, max_limit_rub
  }]).select();
  if(error) return res.status(400).json({ error });
  // notify admin chat
  if (process.env.TELEGRAM_ADMIN_CHAT) {
    await notifyUser(String(process.env.TELEGRAM_ADMIN_CHAT), `🆕 Новая заявка\nUser: ${user_id}\nСумма: ${amount_rub ?? max_limit_rub ?? '—'}₽\nQR: ${qr_payload.slice(0,100)}...`);
  }
  res.json({ success:true, request:data[0] });
}