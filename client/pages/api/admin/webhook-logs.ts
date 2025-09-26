import type { NextApiRequest, NextApiResponse } from "next";
import list, { ListOptions } from "./_list";

const opts: ListOptions = {
  table: "webhook_logs",
  columns: "id,event,status,payload,created_at",
  searchCols: ["event","status","payload"]
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") return list(req, res, opts);
  res.setHeader("Allow", "GET");
  res.status(405).end();
}
