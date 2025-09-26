// lib/requireAuth.ts
export function requireAuth(request: { headers?: any }) {
  const expected = (process.env.ADMIN_SECRET || process.env.NEXT_PUBLIC_ADMIN_SECRET || '').trim();
  if (!expected) {
    throw new Error('ADMIN_SECRET not configured');
  }
  const headers = request?.headers;
  let provided = '';
  if (headers) {
    if (typeof headers.get === 'function') {
      provided = headers.get('authorization') || '';
    } else {
      provided = headers['authorization'] || headers.Authorization || '';
    }
  }
  const match = typeof provided === 'string' ? provided.match(/^Bearer\\s+(.+)$/i) : null;
  const token = match ? match[1] : provided;
  if (token !== expected) {
    throw new Error('Unauthorized');
  }
}
