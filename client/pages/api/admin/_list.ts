import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "./_guard";

export type ListOptions = {
  table: string;
  columns: string;        // comma-separated list of columns
  searchCols?: string[];  // columns to OR-search with ilike
};

function buildSelect(opts: ListOptions, skipCurrency: boolean) {
  const cols = opts.columns
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .filter(c => (skipCurrency ? c !== "currency" : true))
    .join(",");
  const searchCols = (opts.searchCols || []).filter(c => (skipCurrency ? c !== "currency" : true));
  return { cols, searchCols };
}

export default async function listHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  opts: ListOptions
) {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const limit = Math.max(0, Math.min(200, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
    const sort = String(req.query.sort || "created_at.desc");
    const q = String(req.query.q || "").trim();

    const attempt = async (skipCurrency: boolean) => {
      const cfg = buildSelect(opts, skipCurrency);
      let select = supabaseAdmin.from(opts.table).select(cfg.cols, { count: "exact" });

      if (q && cfg.searchCols.length) {
        const pattern = "%" + q + "%";
        const ors: string[] = [];
        for (let i = 0; i < cfg.searchCols.length; i++) {
          ors.push(cfg.searchCols[i] + ".ilike." + pattern);
        }
        select = select.or(ors.join(","));
      }

      const dot = sort.lastIndexOf(".");
      const col = dot > -1 ? sort.slice(0, dot) : sort;
      const dir = dot > -1 ? sort.slice(dot + 1) : "desc";
      if (col) select = select.order(col, { ascending: dir !== "desc", nullsFirst: false });

      const { data, error, count } = await select.range(offset, offset + limit - 1);
      return { data, error, count };
    };

    // 1st try: as requested
    let { data, error, count } = await attempt(false);

    if (error) {
      const msg = String(error.message || "");
      const mightBeMissingColumn = /does not exist/i.test(msg) && /column/i.test(msg);
      const mentionsCurrency = /currency/i.test(msg);
      if (mightBeMissingColumn || mentionsCurrency) {
        const retry = await attempt(true);
        if (!retry.error) {
          return res.status(200).json({ ok: true, items: retry.data || [], total: retry.count ?? (retry.data?.length ?? 0) });
        }
      }
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.status(200).json({ ok: true, items: data || [], total: count ?? (data?.length ?? 0) });
  } catch (e: any) {
    if (e instanceof Response) {
      const text = await e.text();
      return res.status(e.status || 500).send(text);
    }
    res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
}