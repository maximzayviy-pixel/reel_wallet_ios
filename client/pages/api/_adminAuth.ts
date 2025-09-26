// Helper to protect administrative API routes.
//
// Many serverless functions in this repository perform privileged operations
// such as crediting balances, banning users or altering tasks.  Prior to
// introducing this helper these endpoints were effectively open to anyone
// who could issue an HTTP request, because there was no authentication
// implemented.  Attackers could therefore mint stars or TON, modify
// subscription tasks or ban/unban arbitrary accounts.  To mitigate these
// vulnerabilities we now require callers to present a secret token in
// the `Authorization` header.  The expected secret is read from
// `ADMIN_SECRET` (or, for backwards‑compatibility, `INVOICE_SECRET`) in
// the environment.  If the header is missing or the token does not
// match, the request will be rejected with HTTP 401.

import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Ensures that a request is authorised to perform an admin action.
 *
 * Accepts tokens provided via the `Authorization` header.  The header
 * should contain a Bearer token, e.g. `Authorization: Bearer abc123`.
 * The token is compared against `process.env.ADMIN_SECRET` if set,
 * otherwise `process.env.INVOICE_SECRET` as a fallback.  If no secret
 * is configured or the token does not match, an unauthorised response
 * is sent and the caller should cease further processing.
 *
 * @returns true if authorised, false otherwise.  When returning
 *          false the handler MUST return immediately to avoid
 *          performing the privileged action.
 */
export function requireAdmin(req: NextApiRequest, res: NextApiResponse): boolean {
  // Allow only POST/PUT/DELETE/GET when properly authorised.  If the
  // environment is misconfigured (no secret defined) we deliberately
  // refuse access rather than silently allowing it.
  const expected = (process.env.ADMIN_SECRET || process.env.INVOICE_SECRET || "").trim();
  if (!expected) {
    res.status(500).json({ error: "Server misconfigured: ADMIN_SECRET missing" });
    return false;
  }
  const header = String(req.headers["authorization"] || "");
  const tokenMatch = header.match(/^Bearer\s+(.+)$/i);
  const provided = tokenMatch ? tokenMatch[1] : header;
  if (provided !== expected) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return false;
  }
  return true;
}