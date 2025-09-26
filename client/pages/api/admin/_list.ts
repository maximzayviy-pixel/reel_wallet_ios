import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { ensureIsAdmin } from "../../../lib/admin";

export type ListOptions = {
  table: string;
  columns: string;
  searchCols?: string[];
};

export default async function listHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  opts: ListOptions
) {
  try {
    await ensureIsAdmin(req as any);

    const limit = Math.max(0, Math.min(200, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
    const sort = String(req.query.sort || "created_at.desc");
    const q = String(req.query.q || "").trim();

    let select = supabaseAdmin
      .from(opts.table)
      .select(opts.columns, { count: "exact" });

    // ✅ совместимо с target es5: без entries()/for..of
    if (q && opts.searchCols && opts.searchCols.length) {
      const pattern = "%" + q + "%";
      const ors: string[] = [];
      for (let i = 0; i < opts.searchCols.length; i++) {
        ors.push(opts.searchCols[i] + ".ilike." + pattern);
      }
      // пример: "username.ilike.%q%,tg_id.ilike.%q%"
      select = select.or(ors.join(","));
    }

    const dot = sort.lastIndexOf(".");
    const col = dot > -1 ? sort.slice(0, dot) : sort;
    const dir = dot > -1 ? sort.slice(dot + 1) : "desc";
    if (col) select = select.order(col, { ascending: dir !== "desc", nullsFirst: false });

    const { data, error, count } = await select.range(offset, offset + limit - 1);
    if (error) return res.status(400).json({ ok: false, error: error.message });

    res.status(200).json({ ok: true, items: data, total: count ?? (data?.length ?? 0) });
  } catch (e: any) {
    if (e instanceof Response) {
      const text = await e.text();
      return res.status(e.status || 500).send(text);
    }
    res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
}
