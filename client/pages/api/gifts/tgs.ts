// pages/api/gifts/tgs.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { inflate } from "pako";

export const config = { api: { responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const u = (req.query.u as string) || "";
    if (!u) return res.status(400).json({ ok: false, error: "NO_URL" });

    const url = decodeURIComponent(u);
    const r = await fetch(url, {
      redirect: "follow",
      headers: {
        // чуть более «человечный» UA помогает телеграмовскому CDN
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Accept: "*/*",
      },
    });
    if (!r.ok) return res.status(r.status).json({ ok: false, error: "FETCH_FAILED" });

    const buf = await r.arrayBuffer();
    const json = JSON.parse(new TextDecoder().decode(inflate(new Uint8Array(buf))));

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(json);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "TGS_PROXY_FAILED" });
  }
}
