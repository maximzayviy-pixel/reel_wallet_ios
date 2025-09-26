// Verification helper for Telegram WebApp init data.
//
// The Telegram Mini App (WebApp) passes an `initData` string containing
// information about the current user, a query ID and an HMAC hash over
// the data.  The hash ensures that the parameters were produced by
// Telegram and have not been tampered with.  To validate that a
// request is authorised on behalf of a particular Telegram user we
// compute the HMAC of the data using the bot token and compare it
// against the provided hash.  This logic follows the algorithm
// documented at https://core.telegram.org/bots/webapps#validating-data.
//
// If the data is valid this helper returns the parsed user ID (if
// present).  If the data is missing, malformed or fails
// verification the function returns null.

import crypto from "crypto";

interface InitDataInfo {
  tgId?: number;
  /** optional raw user object, if present */
  user?: any;
}

/**
 * Validates a Telegram WebApp init data string.
 *
 * @param initData Raw init data string (e.g. from `x-telegram-init-data` header).
 * @param botToken Telegram bot token used to derive the secret key.
 * @returns Parsed info or null if verification fails.
 */
export function verifyInitData(initData: string | undefined, botToken: string | undefined): InitDataInfo | null {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    // Build the data‑check string: sort all key=value pairs except for "hash"
    const pairs: string[] = [];
    params.forEach((value, key) => {
      if (key === "hash") return;
      pairs.push(`${key}=${value}`);
    });
    pairs.sort();
    const dataCheckString = pairs.join("\n");

    // Compute the secret key and HMAC as per Telegram docs
    const secretKey = crypto
      .createHash("sha256")
      .update(botToken)
      .digest();
    const computed = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");
    if (computed !== hash) return null;

    // Extract user id from the 'user' parameter, which is JSON‑encoded
    let tgId: number | undefined = undefined;
    let user: any = undefined;
    const userStr = params.get("user");
    if (userStr) {
      try {
        const decoded = decodeURIComponent(userStr);
        user = JSON.parse(decoded);
        if (user && typeof user.id === "number") tgId = user.id;
      } catch {
        // ignore parsing errors
      }
    }
    // Fallback: attempt to read chat.id if provided
    const chatInstance = params.get("chat_instance");
    if (!tgId && chatInstance && /^\d+$/.test(chatInstance)) {
      tgId = Number(chatInstance);
    }
    return { tgId, user };
  } catch {
    return null;
  }
}