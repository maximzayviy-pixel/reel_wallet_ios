// client/pages/api/health.ts
export default async function handler(_req, res) {
  return res.status(200).json({ ok: true, ts: Date.now() });
}
