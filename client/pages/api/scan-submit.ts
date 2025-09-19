import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import { notifyUser } from './_notify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const { user_id, qr_payload, qr_image_url, qr_image_b64, amount_rub, max_limit_rub } = (req.body || {}) as any;

  // Prepare imageUrl: either provided URL or upload from base64 to Supabase Storage
  let imageUrl: string | null = qr_image_url || null;
  try {
    if (!imageUrl && qr_image_b64) {
      const base64 = String(qr_image_b64).split(',')[1];
      const bin = Buffer.from(base64, 'base64');
      const path = `qr-shots/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const up = await supabase.storage.from('qr-shots').upload(path, bin, { contentType: 'image/jpeg', upsert: false });
      if (!up.error) {
        const pub = supabase.storage.from('qr-shots').getPublicUrl(path);
        imageUrl = pub.data.publicUrl;
      }
    }
  } catch (e) {
    console.error('QR image upload failed', e);
  }

  const { data, error } = await supabase.from('payment_requests').insert([{
    user_id, qr_payload, qr_image_url: imageUrl, amount_rub, max_limit_rub
  }]).select();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // notify admin chat
  if (process.env.TELEGRAM_ADMIN_CHAT) {
    try {
      await notifyUser(String(process.env.TELEGRAM_ADMIN_CHAT), `🆕 Новая заявка\nUser: ${user_id}\nСумма: ${amount_rub ?? max_limit_rub ?? '—'}₽\nQR: ${String(qr_payload).slice(0,100)}...` + (imageUrl ? `\n📸 ${imageUrl}` : ''));
    } catch (e) {
      console.error('Notify admin failed', e);
    }
  }

  return res.json({ success: true, request: data?.[0] });
}
