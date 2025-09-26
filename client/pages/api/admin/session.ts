
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from './_guard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;
  res.setHeader('Set-Cookie', `tg_admin=1; Path=/; Max-Age=${60*60*24}; HttpOnly; Secure; SameSite=Lax`);
  res.json({ ok: true });
}
