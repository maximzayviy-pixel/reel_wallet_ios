import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    ok: true,
    hasSupaUrl: !!process.env.SUPABASE_URL,
    hasSupaServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    ts: Date.now()
  });
}
