import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Simple healthcheck for Vercel/Next API routing.
 * Should return 200 with { ok: true, ts } when /client is set as Root Directory
 * and this file lives at client/pages/api/health.ts
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ ok: true, ts: Date.now() })
}
