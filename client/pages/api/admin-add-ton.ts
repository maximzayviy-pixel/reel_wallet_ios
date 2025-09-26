import { createClient } from '@supabase/supabase-js';

/**
 * API route for administrators to manually credit TON to a user's balance.
 * Expects POST with user_id (uuid) and amount_ton (numeric). Updates
 * both the ledger and balances tables similarly to how topup-ton.ts works.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { user_id, amount_ton } = req.body || {};
  if (!user_id || !amount_ton) return res.status(400).json({ error: 'user_id and amount_ton are required' });
  const ton = Number(amount_ton);
  if (!isFinite(ton) || ton <= 0) return res.status(400).json({ error: 'amount_ton must be positive' });
  // Convert TON to RUB at a rate of 300 RUB per TON
  const rub = ton * 300;
  try {
    // Insert into ledger table
    await supabase.from('ledger').insert({
      user_id,
      type: 'admin_topup_ton',
      amount_rub: rub,
      asset_amount: ton,
      rate_used: 300,
      status: 'done',
      metadata: { source: 'admin' },
    });
    // Credit rub balance via RPC to sync rub balance and bonus
    await supabase.rpc('credit_user_balance', { p_user_id: user_id, p_amount: rub });
    // Update ton balance in balances table
    const { data: bal } = await supabase.from('balances').select('ton').eq('user_id', user_id).single();
    const currentTon = Number(bal?.ton || 0);
    await supabase.from('balances').update({ ton: currentTon + ton }).eq('user_id', user_id);
    res.json({ success: true, credited_ton: ton, credited_rub: rub });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed to credit TON' });
  }
}