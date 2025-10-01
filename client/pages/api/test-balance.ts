// API для тестирования обновления баланса
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const { tg_id } = req.body;
  if (!tg_id) {
    return res.status(400).json({ ok: false, error: 'tg_id required' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ ok: false, error: 'NO_SUPABASE_CREDS' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    console.log('Testing balance update for tg_id:', tg_id);

    // 1. Проверяем текущий баланс
    const { data: currentBalance, error: balanceError } = await supabase
      .from('balances_by_tg')
      .select('*')
      .eq('tg_id', tg_id)
      .single();

    console.log('Current balance:', currentBalance);

    // 2. Тестируем функцию обновления баланса
    const { error: updateError } = await supabase.rpc('update_user_balance_by_tg_id', {
      p_tg_id: Number(tg_id)
    });

    if (updateError) {
      console.error('Balance update error:', updateError);
      return res.status(500).json({ ok: false, error: updateError.message });
    }

    console.log('Balance update function executed successfully');

    // 3. Проверяем баланс после обновления
    const { data: newBalance, error: newBalanceError } = await supabase
      .from('balances_by_tg')
      .select('*')
      .eq('tg_id', tg_id)
      .single();

    console.log('New balance:', newBalance);

    return res.json({
      ok: true,
      tg_id,
      currentBalance,
      newBalance,
      changed: currentBalance?.stars !== newBalance?.stars
    });

  } catch (e: any) {
    console.error('Test balance error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
