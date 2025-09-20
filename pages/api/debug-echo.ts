// pages/api/debug-echo.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isJson = (req.headers['content-type']||'').includes('application/json');
  res.status(200).json({
    method: req.method,
    contentType: req.headers['content-type'] || null,
    isJson,
    bodyType: typeof req.body,
    body: req.body,
  });
}
