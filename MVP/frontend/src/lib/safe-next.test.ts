import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

/**
 * `?next=` is attacker-controlled: a link to /login?next=https://evil.example
 * or ?next=javascript:… must never be followed after a real sign-in. Only a
 * path on this site survives; anything else falls back to the default.
 */
describe("safeNextPath", () => {
  it.each(["/checkout", "/listings/42", "/marketplace?space_type=Hoarding#grid", "/"])(
    "keeps the same-site path %s",
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    null,
    "",
    "https://evil.example",
    "http://evil.example/login",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(document.domain)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "checkout",
    "/\tevil",
    "/%0a/evil.example",
  ])("refuses %s", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });
});

describe("sign-in forms only follow a sanitised ?next=", () => {
  const forms = ["../app/(auth)/login/LoginForm.tsx", "../app/(auth)/register/RegisterForm.tsx"];
  it.each(forms)("%s passes ?next= through safeNextPath", (file) => {
    const source = readFileSync(join(__dirname, file), "utf8");
    expect(source).toMatch(/safeNextPath\(\s*searchParams\.get\("next"\)\s*\)/);
  });
});
