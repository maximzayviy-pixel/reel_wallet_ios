import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { user_id, qr_payload, imageUrl, amount_rub, max_limit_rub } = req.body ?? {};
    const { data, error } = await supabase.from('payment_requests').insert([
      {
        user_id,
        qr_payload,
        image_url: (imageUrl as string) || null,
        amount_rub,
        max_limit_rub,
      },
    ]).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ ok: true, request: data });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}