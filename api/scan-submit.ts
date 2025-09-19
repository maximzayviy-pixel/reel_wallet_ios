import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { user_id, qr_payload, qr_image_url, amount_rub, max_limit_rub } = req.body;

  const { data, error } = await supabase
    .from('payment_requests')
    .insert([{ user_id, qr_payload, qr_image_url, amount_rub, max_limit_rub }])
    .select();

  if (error) return res.status(400).json({ error });
  res.json({ success: true, request: data[0] });
}