// Minimal authentication helper for the new Next.js `app` router.
//
// Several server components and route handlers under the `app/admin` and
// `app/api/admin` namespaces import this helper to enforce that the
// caller is authorised to perform administrative actions.  Without
// this file the build would fail with “module not found”.
//
// This implementation checks for a shared secret in the `Authorization`
// header.  The secret should be set via `ADMIN_SECRET` or, for
// backwards‑compatibility, `NEXT_PUBLIC_ADMIN_SECRET`.  If the header
// does not match the secret, an exception is thrown.  Upstream code
// should catch this and return a 401 response.

export function requireAuth(request: { headers?: any }) {
  const expected = (process.env.ADMIN_SECRET || process.env.NEXT_PUBLIC_ADMIN_SECRET || '').trim();
  if (!expected) {
    throw new Error('ADMIN_SECRET not configured');
  }
  const headers = request?.headers;
  let provided = '';
  if (headers) {
    // In the App Router, `headers` may be a Headers instance; support both
    if (typeof headers.get === 'function') {
      provided = headers.get('authorization') || '';
    } else if (typeof headers === 'object') {
      provided = headers['authorization'] || headers.Authorization || '';
    }
  }
  // Expect format "Bearer <token>" but also accept raw token for convenience
  const match = typeof provided === 'string' ? provided.match(/^Bearer\s+(.+)$/i) : null;
  const token = match ? match[1] : provided;
  if (token !== expected) {
    throw new Error('Unauthorized');
  }
}