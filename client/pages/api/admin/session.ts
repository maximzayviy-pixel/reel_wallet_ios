import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from './_guard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  // 24 часа, HttpOnly, подходит для webview Telegram (SameSite=None; Secure)
  res.setHeader(
    'Set-Cookie',
    'tg_admin=1; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=None'
  );
  res.status(200).json({ ok: true, user: { id: user.id, tg_id: user.tg_id, role: user.role } });
}