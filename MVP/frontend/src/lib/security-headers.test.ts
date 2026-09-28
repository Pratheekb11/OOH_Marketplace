import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { securityHeaders } from "./security-headers";

/**
 * Site-wide response headers. The CSP is the backstop for any XSS that slips
 * through: scripts only from this site and Google's sign-in client, no
 * plugins, no <base> hijack, forms only post here, and no other site may
 * frame a page (clickjacking on login or checkout).
 */
const API = "https://ooh-api.example.vercel.app/api/v1";

function asMap(headers: { key: string; value: string }[]) {
  return Object.fromEntries(headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

function directives(csp: string) {
  return Object.fromEntries(
    csp
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name, values];
      }),
  ) as Record<string, string[]>;
}

describe("securityHeaders (production)", () => {
  const headers = asMap(securityHeaders({ dev: false, apiBaseUrl: API }));
  const csp = directives(headers["content-security-policy"]);

  it("locks down framing, plugins, <base> and form targets", () => {
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
  });

  it("allows scripts only from this site and Google sign-in, never eval", () => {
    expect(csp["script-src"]).toContain("'self'");
    expect(csp["script-src"]).toContain("https://accounts.google.com/gsi/client");
    expect(csp["script-src"]).not.toContain("'unsafe-eval'");
    for (const wildcard of ["*", "https:", "http:", "data:"]) {
      expect(csp["script-src"]).not.toContain(wildcard);
    }
  });

  it("lets the page reach the API origin and Google sign-in, nothing broader", () => {
    expect(csp["connect-src"]).toContain("'self'");
    expect(csp["connect-src"]).toContain("https://ooh-api.example.vercel.app");
    expect(csp["connect-src"]).toContain("https://accounts.google.com/gsi/");
    expect(csp["connect-src"]).not.toContain("*");
    expect(csp["frame-src"]).toContain("https://accounts.google.com/gsi/");
  });

  it("keeps the map tiles, icon font and Google button styles working", () => {
    expect(csp["img-src"]).toContain("https://tile.openstreetmap.org");
    expect(csp["style-src"]).toContain("https://fonts.googleapis.com");
    expect(csp["style-src"]).toContain("https://accounts.google.com/gsi/style");
    expect(csp["font-src"]).toContain("https://fonts.gstatic.com");
  });

  it("sends the rest of the hardening set", () => {
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains");
    expect(headers["permissions-policy"]).toMatch(/camera=\(\)/);
    expect(headers["permissions-policy"]).toMatch(/microphone=\(\)/);
    // Google's sign-in popup must be able to post its result back.
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
  });
});

describe("securityHeaders (development)", () => {
  it("allows what Next's dev server needs, and only there", () => {
    const csp = directives(asMap(securityHeaders({ dev: true, apiBaseUrl: "http://127.0.0.1:8000/api/v1" }))["content-security-policy"]);
    expect(csp["script-src"]).toContain("'unsafe-eval'");
    expect(csp["connect-src"]).toContain("http://127.0.0.1:8000");
  });

  it("falls back to the local API when no base URL is configured", () => {
    const csp = directives(asMap(securityHeaders({ dev: true, apiBaseUrl: undefined }))["content-security-policy"]);
    expect(csp["connect-src"]).toContain("http://127.0.0.1:8000");
  });
});

describe("next.config", () => {
  it("applies the headers to every route", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === "/:path*");
    expect(all).toBeDefined();
    const headers = asMap(all!.headers);
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
  });
});

describe("securityHeaders (API behind the site's own /api/v1 rewrite)", () => {
  // Production sets NEXT_PUBLIC_API_BASE_URL to the relative "/api/v1": the
  // browser only ever talks to this origin, which 'self' already covers.
  const csp = directives(asMap(securityHeaders({ dev: false, apiBaseUrl: "/api/v1" }))["content-security-policy"]);

  it("adds no other origin for a relative base URL", () => {
    expect(csp["connect-src"]).toContain("'self'");
    expect(csp["connect-src"]).toContain("https://accounts.google.com/gsi/");
    expect(csp["connect-src"].join(" ")).not.toMatch(/127\.0\.0\.1|localhost|http:/);
  });
});
