import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string, // нужен сервисный ключ, не public anon
  { auth: { persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const raw = (req.query.tg_id ?? '').toString();
    const tgId = Number(raw);
    if (!tgId || !Number.isFinite(tgId)) {
      return res.status(400).json({ error: 'tg_id is required' });
    }

    // дергаем вашу функцию
    const { data, error } = await supabase.rpc('get_balance_by_tg', { tg_id: tgId });
    if (error) throw error;

    // функция обычно возвращает одну строку { stars, ton, total_rub? }
    const row = (Array.isArray(data) ? data[0] : data) || { stars: 0, ton: 0 };
    return res.status(200).json({ stars: Number(row.stars) || 0, ton: Number(row.ton) || 0 });
  } catch (e: any) {
    console.error('my-balance error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}
