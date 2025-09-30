// pages/api/roulette-spin.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

type SpinResult =
  | { ok: true; prize: number | 'PLUSH_PEPE_NFT'; stars_after: number }
  | { ok: false; error: string; details?: any };

const COST = 15;

// те же веса, что в интерфейсе
const PRIZES: Array<{ value: number | 'PLUSH_PEPE_NFT'; weight: number }> = [
  { value: 3, weight: 30 },
  { value: 5, weight: 24 },
  { value: 10, weight: 18 },
  { value: 15, weight: 12 },
  { value: 50, weight: 8 },
  { value: 100, weight: 5.5 },
  { value: 1000, weight: 2.4 },
  { value: 'PLUSH_PEPE_NFT', weight: 0.1 },
];

function weightedRandom() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    if ((r -= p.weight) <= 0) return p.value;
  }
  return PRIZES[0].value;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SpinResult>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const tg_id = Number(req.body?.tg_id ?? req.query?.tg_id);
  if (!tg_id) return res.status(400).json({ ok: false, error: 'tg_id_required' });

  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  if (!url || !key) {
    return res.status(500).json({ ok: false, error: 'SUPABASE_ENV_MISSING' });
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 1) читаем баланс из materialized view / view
  const { data: balRow, error: balErr } = await supabase
    .from('balances_by_tg')
    .select('stars')
    .eq('tg_id', tg_id)
    .maybeSingle();

  if (balErr) {
    return res
      .status(500)
      .json({ ok: false, error: 'BALANCE_QUERY_FAILED', details: balErr.message });
  }

  const stars = Number(balRow?.stars || 0);
  if (Number.isNaN(stars)) {
    return res.status(500).json({ ok: false, error: 'BALANCE_PARSE_FAILED' });
  }

  if (stars < COST) {
    return res.status(400).json({ ok: false, error: 'NOT_ENOUGH_STARS' });
  }

  // 2) розыгрыш
  const prize = weightedRandom();

  // 3) одна проводка: (приз − стоимость)
  const delta = typeof prize === 'number' ? prize - COST : -COST;

  const meta: any = {
    source: 'roulette',
    cost: COST,
    prize,
    at: new Date().toISOString(),
  };

  // 3.1) пишем в ledger
  const { error: ledErr } = await supabase
    .from('ledger')
    .insert([{ tg_id, delta, meta }]);

  if (ledErr) {
    return res
      .status(500)
      .json({ ok: false, error: 'LEDGER_INSERT_FAILED', details: ledErr.message });
  }

  // 3.2) если NFT — создаём клейм
  if (prize === 'PLUSH_PEPE_NFT') {
    await supabase.from('gifts_claims').insert([
      {
        tg_id,
        gift_code: 'PLUSH_PEPE_NFT',
        title: 'Plush Pepe NFT',
        image_url: 'https://i.imgur.com/BmoA5Ui.jpeg',
        status: 'pending',
        meta,
      },
    ]);
  }

  // 4) возвращаем новый баланс (быстро пересчитываем)
  const { data: bal2 } = await supabase
    .from('balances_by_tg')
    .select('stars')
    .eq('tg_id', tg_id)
    .maybeSingle();

  const stars_after = Number(bal2?.stars ?? stars + delta);

  return res.status(200).json({ ok: true, prize, stars_after });
}
