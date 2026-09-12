/* Security response headers (P14 hardening): applied to every response.
   frame-ancestors 'none' replaces X-Frame-Options for modern browsers;
   both are sent for legacy clients. Script CSP is intentionally not
   enforced yet (Nuxt payload inline scripts) — revisit in a later phase. */

export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': 'frame-ancestors \'none\'; base-uri \'self\'; object-src \'none\''
  })
})
