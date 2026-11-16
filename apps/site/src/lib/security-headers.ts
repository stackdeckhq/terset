// The security headers every response carries. The worker adds them to the raw files and
// the 404 page in src/server.ts. public/_headers holds the same lines for static assets and
// the prerendered pages, which Workers serves before the worker runs; a test keeps the two
// in step.

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/** Returns the response with every security header set. Copies it so immutable headers never throw. */
export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
