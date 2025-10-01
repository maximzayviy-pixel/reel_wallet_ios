import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import handler, {
  __setSupabaseClientFactory,
} from "../pages/api/transfer-stars.ts";

type SupabaseMockConfig = {
  fromUserId: number;
  toUserId: number;
  senderStars: number;
  ledgerInserts: any[];
};

function createSupabaseMock(config: SupabaseMockConfig) {
  const { fromUserId, toUserId, senderStars, ledgerInserts } = config;
  return {
    from(table: string) {
      if (table === "users") {
        return {
          select() {
            return {
              eq(_column: string, value: number) {
                return {
                  async maybeSingle() {
                    if (value === fromUserId) {
                      return { data: { id: 1, tg_id: fromUserId } };
                    }
                    if (value === toUserId) {
                      return { data: { id: 2, tg_id: toUserId } };
                    }
                    return { data: null };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "balances_by_tg") {
        return {
          select() {
            return {
              eq(_column: string, value: number) {
                return {
                  async maybeSingle() {
                    if (value === fromUserId) {
                      return { data: { stars: senderStars } };
                    }
                    return { data: null };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "ledger") {
        return {
          async insert(rows: any[]) {
            ledgerInserts.push(...rows);
            return { error: null };
          },
        };
      }

      if (table === "webhook_logs") {
        return {
          async insert() {
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    async rpc() {
      return { data: null };
    },
  } satisfies Record<string, any>;
}

function createResponse() {
  const res: Partial<NextApiResponse> & {
    statusCode: number;
    jsonData: any;
  } = {
    statusCode: 200,
    jsonData: undefined,
    status(code: number) {
      this.statusCode = code;
      return this as any;
    },
    json(data: any) {
      this.jsonData = data;
      return this as any;
    },
  };
  return res as NextApiResponse & { statusCode: number; jsonData: any };
}

function buildInitData(botToken: string, userId: number) {
  const params = new URLSearchParams();
  params.set("auth_date", String(Math.floor(Date.now() / 1000)));
  params.set("query_id", "AAH");
  params.set("user", JSON.stringify({ id: userId }));

  const pairs: string[] = [];
  params.forEach((value, key) => {
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  params.set("hash", hash);
  return params.toString();
}

test("allows transfer when Telegram auth is valid", async () => {
  process.env.SUPABASE_URL = "https://supabase.local";
  process.env.SUPABASE_SERVICE_KEY = "service-key";
  process.env.TELEGRAM_BOT_TOKEN = "bot-token";

  const ledgerInserts: any[] = [];
  const supabaseClient = createSupabaseMock({
    fromUserId: 111,
    toUserId: 222,
    senderStars: 10,
    ledgerInserts,
  });

  __setSupabaseClientFactory(() => supabaseClient as any);

  const req: Partial<NextApiRequest> = {
    method: "POST",
    headers: {
      "x-telegram-init-data": buildInitData("bot-token", 111),
    },
    body: {
      to_tg_id: 222,
      amount_stars: 5,
    },
  };

  const res = createResponse();
  await handler(req as NextApiRequest, res as NextApiResponse);

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonData?.ok, true);
  assert.equal(res.jsonData?.from_tg_id, 111);
  assert.equal(res.jsonData?.to_tg_id, 222);
  assert.equal(res.jsonData?.amount_stars, 5);
  assert.equal(ledgerInserts.length, 2);
  assert.equal(ledgerInserts[0].tg_id, 111);
  assert.equal(ledgerInserts[1].tg_id, 222);

  __setSupabaseClientFactory();
});

test("rejects transfer when from_tg_id is tampered", async () => {
  process.env.SUPABASE_URL = "https://supabase.local";
  process.env.SUPABASE_SERVICE_KEY = "service-key";
  process.env.TELEGRAM_BOT_TOKEN = "bot-token";

  const supabaseClient = createSupabaseMock({
    fromUserId: 111,
    toUserId: 222,
    senderStars: 10,
    ledgerInserts: [],
  });

  __setSupabaseClientFactory(() => supabaseClient as any);

  const req: Partial<NextApiRequest> = {
    method: "POST",
    headers: {
      "x-telegram-init-data": buildInitData("bot-token", 111),
    },
    body: {
      from_tg_id: 123456,
      to_tg_id: 222,
      amount_stars: 5,
    },
  };

  const res = createResponse();
  await handler(req as NextApiRequest, res as NextApiResponse);

  assert.equal(res.statusCode, 403);
  assert.equal(res.jsonData?.ok, false);
  assert.equal(res.jsonData?.error, "FROM_ID_MISMATCH");

  __setSupabaseClientFactory();
});
