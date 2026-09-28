/**
 * Where to send someone after they sign in, from an untrusted `?next=`.
 *
 * Only a path on this site is allowed. Everything else -- another origin
 * (`https://…`, protocol-relative `//…`, the `/\…` form browsers treat the
 * same way), a `javascript:` or `data:` URL, or anything hiding control
 * characters or backslashes, raw or percent-encoded -- returns null so the
 * caller falls back to its default page. The router would otherwise follow a
 * foreign URL with `location.assign`, which runs `javascript:` in our origin.
 */
const UNSAFE = /[\u0000-\u001f\u007f\\]/;
const BASE = "https://same-site.invalid";

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || UNSAFE.test(raw)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || UNSAFE.test(decoded)) return null;

  try {
    if (new URL(raw, BASE).origin !== BASE) return null;
  } catch {
    return null;
  }
  return raw;
}
