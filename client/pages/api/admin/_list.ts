import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { ensureIsAdmin } from "../../../lib/admin";

export type ListOptions = {
  table: string;
  columns: string;
  searchCols?: string[];
};

export default async function listHandler(req: NextApiRequest, res: NextApiResponse, opts: ListOptions) {
  try {
    await ensureIsAdmin(req as any);
    const limit = Math.max(0, Math.min(200, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
    const sort = String(req.query.sort || "created_at.desc");
    const q = String(req.query.q || "").trim();

    let select = supabaseAdmin.from(opts.table).select(opts.columns, { count: "exact" });

    if (q && opts.searchCols?.length) {
      // simple ILIKE OR
      const pattern = `%${q}%`;
      for (const [i, col] of opts.searchCols.entries()) {
        select = i === 0 ? select.ilike(col, pattern) : select.or(`${col}.ilike.${pattern}`);
      }
    }

    const [col, dir] = sort.split(".");
    if (col) select = select.order(col, { ascending: dir !== "desc", nullsFirst: false });

    const { data, error, count } = await select.range(offset, offset + limit - 1);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    res.status(200).json({ ok:true, items: data, total: count ?? data?.length ?? 0 });
  } catch (e:any) {
    if (e instanceof Response) {
      const text = await e.text();
      return res.status(e.status || 500).send(text);
    }
    res.status(500).json({ ok:false, error: e?.message || "SERVER_ERROR" });
  }
}
