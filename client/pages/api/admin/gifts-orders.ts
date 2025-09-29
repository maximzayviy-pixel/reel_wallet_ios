import type { NextApiRequest, NextApiResponse } from "next";
import list, { ListOptions } from "./_list";

const opts: ListOptions = {
  table: "gift_orders",
  columns: "id,tg_id,gift_id,price,status,created_at",
  searchCols: ["tg_id","status"]
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") return list(req, res, opts);
  res.setHeader("Allow", "GET");
  res.status(405).end();
}