/**
 * Response headers for every page, applied from next.config.ts.
 *
 * The CSP is the backstop for any XSS that slips past React's escaping:
 * scripts come only from this site and Google's sign-in client, nothing may
 * embed a plugin, rewrite <base>, post a form off-site, or frame a page.
 *
 * `'unsafe-inline'` stays on script-src because Next injects inline bootstrap
 * scripts; removing it needs per-request nonces, which would turn every
 * statically generated page dynamic. Everything else is an explicit list:
 *   - Google Identity Services: its client script, button iframe, styles and
 *     the endpoints the button calls (popup mode; see GoogleAuthButton).
 *   - OpenStreetMap tiles for the marketplace map (MapPanel).
 *   - Material Symbols, the one font still loaded from Google Fonts.
 *   - The API, when NEXT_PUBLIC_API_BASE_URL is an absolute URL (local dev).
 *     Production sets the relative "/api/v1", proxied by vercel.json's
 *     rewrite, so the browser never leaves this origin there.
 */
const LOCAL_API = "http://127.0.0.1:8000/api/v1";
const GOOGLE_SIGN_IN = "https://accounts.google.com/gsi/";

/** The API's origin for connect-src, or "" when it is this site's own origin:
 * production uses the relative "/api/v1" behind vercel.json's rewrite, which
 * 'self' already covers. */
function origin(url: string | undefined): string {
  if (url?.startsWith("/")) return "";
  try {
    return new URL(url || LOCAL_API).origin;
  } catch {
    return new URL(LOCAL_API).origin;
  }
}

export interface SecurityHeaderOptions {
  /** `next dev`: React refresh needs eval and a websocket back to the server. */
  dev: boolean;
  apiBaseUrl: string | undefined;
}

export function securityHeaders({ dev, apiBaseUrl }: SecurityHeaderOptions): { key: string; value: string }[] {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} ${GOOGLE_SIGN_IN}client`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${GOOGLE_SIGN_IN}style`,
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    ["connect-src 'self'", origin(apiBaseUrl), GOOGLE_SIGN_IN, dev ? "ws: wss:" : ""].filter(Boolean).join(" "),
    `frame-src ${GOOGLE_SIGN_IN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    // Not plain same-origin: Google's sign-in popup posts its result back to this window.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
}
