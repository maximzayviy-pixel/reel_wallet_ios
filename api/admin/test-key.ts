import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "./_guard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;               // здесь уже отправится 401/403
  res.json({ ok: true });           // ключ принят
}
