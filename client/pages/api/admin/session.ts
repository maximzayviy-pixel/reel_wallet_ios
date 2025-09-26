import type { NextApiRequest, NextApiResponse } from "next";
import { ensureIsAdmin } from "../../../lib/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { tgId } = await ensureIsAdmin(req as any);
    res.status(200).json({ ok: true, tgId });
  } catch (e:any) {
    if (e instanceof Response) {
      const text = await e.text();
      return res.status(e.status || 500).send(text);
    }
    res.status(403).json({ ok:false });
  }
}
