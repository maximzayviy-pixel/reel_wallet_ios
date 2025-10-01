import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';

type EndpointCase = {
  name: string;
  file: string;
  body: Record<string, any>;
};

type MockResponse = {
  statusCode: number;
  body?: any;
  status: (code: number) => MockResponse;
  json: (payload: any) => MockResponse;
  end: () => MockResponse;
};

const endpoints: EndpointCase[] = [
  {
    name: 'admin-add-ton',
    file: 'admin-add-ton',
    body: { user_id: 'user-1', amount_ton: 1 },
  },
  {
    name: 'admin-bonus',
    file: 'admin-bonus',
    body: { user_id: 'user-1', amount_rub: 100 },
  },
  {
    name: 'admin-ban',
    file: 'admin-ban',
    body: { user_id: 'user-1', reason: 'test' },
  },
  {
    name: 'admin-confirm',
    file: 'admin-confirm',
    body: { request_id: 'req-1', paid_amount_rub: 100 },
  },
  {
    name: 'admin-reject',
    file: 'admin-reject',
    body: { request_id: 'req-1' },
  },
  {
    name: 'admin-set-limit',
    file: 'admin-set-limit',
    body: { user_id: 'user-1', wallet_limit: 100 },
  },
  {
    name: 'admin-unban',
    file: 'admin-unban',
    body: { user_id: 'user-1' },
  },
];

function createMockRes(): MockResponse & { body?: any } {
  const res: Partial<MockResponse & { body?: any }> = {
    statusCode: 200,
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res as MockResponse;
  };
  res.json = (payload: any) => {
    res.body = payload;
    return res as MockResponse;
  };
  res.end = () => res as MockResponse;
  return res as MockResponse & { body?: any };
}

for (const endpoint of endpoints) {
  test(`rejects unauthenticated access to ${endpoint.name}`, async () => {
    const guardPath = path.join(__dirname, '..', 'pages', 'api', 'admin', '_guard.js');
    let guardCalls = 0;
    require.cache[guardPath] = {
      id: guardPath,
      filename: guardPath,
      loaded: true,
      exports: {
        requireAdmin: async (_req: unknown, res: MockResponse) => {
          guardCalls += 1;
          res.status(401).json({ error: 'FORBIDDEN' });
          return null;
        },
      },
    } as any;

    const supabasePath = require.resolve('@supabase/supabase-js');
    const originalSupabaseCache = require.cache[supabasePath];
    const supabaseExports = originalSupabaseCache?.exports ?? require(supabasePath);
    const createClientCalls: number[] = [];
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: {
        ...supabaseExports,
        createClient: (..._args: any[]) => {
          createClientCalls.push(1);
          return {};
        },
      },
    } as any;

    const handlerPath = path.join(__dirname, '..', 'pages', 'api', `${endpoint.file}.js`);
    delete require.cache[handlerPath];
    const handlerModule = require(handlerPath);
    const handler = handlerModule.default ?? handlerModule;

    const res = createMockRes();
    await handler({ method: 'POST', body: endpoint.body }, res);

    assert.equal(guardCalls, 1);
    assert.ok(res.statusCode === 401 || res.statusCode === 403);
    assert.ok(res.body && typeof res.body.error === 'string');
    assert.equal(createClientCalls.length, 0);

    delete require.cache[guardPath];
    if (originalSupabaseCache) {
      require.cache[supabasePath] = originalSupabaseCache;
    } else {
      delete require.cache[supabasePath];
    }
  });
}
