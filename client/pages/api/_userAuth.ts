// Helper to authorise user‑initiated API calls via Telegram init data.
//
// Many endpoints in this project allow users to perform actions on
// behalf of their Telegram identity, such as redeeming promo codes,
// spinning the roulette or submitting payment requests.  Prior to
// introducing this helper these routes trusted arbitrary `tg_id`
// values supplied in the body which allowed attackers to spoof
// requests for other users and manipulate account balances.  To fix
// this we now require that the caller either present a valid admin
// secret or include the WebApp `initData` string so we can verify
// their Telegram user id.  See `_verifyInitData.ts` for details on
// the verification algorithm.

import type { NextApiRequest, NextApiResponse } from "next";
import { verifyInitData } from "./_verifyInitData";

/**
 * Ensures that the request originates from the expected Telegram user.
 *
 * If the caller provides a correct admin token (via the
 * `Authorization` header) no further checks are performed.  Otherwise
 * the `x-telegram-init-data` header must be present and contain
 * Telegram WebApp init data signed by Telegram.  The helper verifies
 * the signature using the bot token and compares the resulting
 * `tgId` to the supplied `tgId` argument.  If the ids differ or
 * verification fails an HTTP 401 response is sent and the function
 * returns false.  On success it returns true.
 *
 * @param req The incoming request.
 * @param res The response on which to send a 401 error if auth fails.
 * @param tgId The Telegram id that the caller is claiming to act as.
 */
export function requireUser(req: NextApiRequest, res: NextApiResponse, tgId?: string | number | null): boolean {
  // Admin override: allow admin secret to bypass user verification.
  const expectedAdmin = (process.env.ADMIN_SECRET || process.env.INVOICE_SECRET || "").trim();
  if (expectedAdmin) {
    const headerAuth = String(req.headers["authorization"] || "");
    const match = headerAuth.match(/^Bearer\s+(.+)/i);
    const provided = match ? match[1] : headerAuth;
    if (provided === expectedAdmin) return true;
  }

  // Extract and verify Telegram init data.
  const initData = req.headers["x-telegram-init-data"] as string | undefined;
  const botToken =
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TG_BOT_TOKEN ||
    process.env.TELEGRAM_BOT ||
    "";
  const info = verifyInitData(initData, botToken);
  const authTg = info?.tgId;
  if (!authTg) {
    res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return false;
  }
  // If the endpoint expects a tg_id then ensure it matches the id from init data.
  if (tgId !== undefined && tgId !== null && String(authTg) !== String(tgId)) {
    res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return false;
  }
  return true;
}