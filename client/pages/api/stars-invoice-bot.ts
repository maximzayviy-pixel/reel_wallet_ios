import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT || process.env.TG_BOT_TOKEN;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    if (!BOT_TOKEN) {
      return res.status(500).json({ ok: false, error: 'No BOT TOKEN in env (TELEGRAM_BOT_TOKEN)' });
    }

    const { amount_stars, tg_id, business_connection_id } = req.body || {};
    const stars = Number(amount_stars);

    if (!Number.isFinite(stars) || stars <= 0) {
      return res.status(400).json({ ok: false, error: 'amount_stars required' });
    }

    // Check if the user is banned before generating an invoice
    try {
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (SUPABASE_URL && SERVICE_KEY && tg_id) {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
        const { data: userRec, error: uErr } = await supabase.from('users').select('id,is_banned').eq('tg_id', tg_id).maybeSingle();
        if (uErr) {
          return res.status(500).json({ ok: false, error: uErr.message });
        }
        if (userRec && userRec.is_banned) {
          return res.status(403).json({ ok: false, error: 'USER_BANNED' });
        }
      }
    } catch (e: any) {
      // ignore supabase errors here; invoice generation will fail later if misconfigured
    }

    const payload = `stars_topup:${tg_id || ''}:${Date.now()}:${stars}`;

    const body = new URLSearchParams({
      title: 'Пополнение Reel Wallet',
      description: `Пополнение баланса на ${stars} ⭐`,
      payload,
      currency: 'XTR',
      prices: JSON.stringify([{ label: '⭐', amount: stars }]),
    });

    if (business_connection_id) {
      body.set('business_connection_id', String(business_connection_id));
    }

    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const j = await r.json().catch(() => ({} as any));

    if (!j?.ok || !j?.result) {
      return res.status(400).json({ ok: false, error: j?.description || 'INVOICE_FAILED' });
    }

    return res.status(200).json({ ok: true, link: j.result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Internal error' });
  }
}