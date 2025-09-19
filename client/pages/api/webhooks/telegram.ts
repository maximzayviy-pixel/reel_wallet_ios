import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const secret = process.env.INVOICE_SECRET || 'changeme';

export const config = {
  api: { bodyParser: { sizeLimit: '2mb' } }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const update = req.body;

  // We only care about successful payments
  const success = update?.message?.successful_payment || update?.successful_payment;
  if (!success) return res.json({ ok: true });

  const payloadStr = success.invoice_payload || '';
  const [payload, sig] = payloadStr.split('|');
  try {
    const expect = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (expect !== sig) return res.status(400).json({ error: 'bad signature' });
    const { tg_id, amt } = JSON.parse(payload);
    const stars = Number(amt || 0);
    if (!tg_id || !stars) return res.status(400).json({ error: 'invalid payload' });

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    // ensure user
    const { data: user } = await supabase.from('users').select('id').eq('tg_id', String(tg_id)).single();
    const user_id = user?.id;
    if (!user_id) return res.status(404).json({ error: 'user not found' });

    // credit balances: stars and ruble-equivalent (2⭐=1₽)
    await supabase.from('balances').update({
      stars: (await supabase.from('balances').select('stars').eq('user_id', user_id).single()).data.stars + stars
    }).eq('user_id', user_id);

    await supabase.rpc('credit_user_balance', { p_user_id: user_id, p_amount: stars / 2.0 });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
