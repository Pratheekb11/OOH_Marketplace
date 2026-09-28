import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P0-5 guard: figures and credentials that no data backs must not come back
 * through some other component. Scans every non-test source file.
 */
const SRC = join(__dirname, "..");

const BANNED = [
  "500+",
  "₹50Cr+",
  "₹2.5L+",
  "5yr Verified Partner",
  "primary leasing rights",
  "hundreds of media owners",
  "bengaluru-static.png",
  // Demo passwords must never be published on the site.
  "password123",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("no unbacked marketing claims (P0-5)", () => {
  it.each(BANNED)("no source file contains %s", (claim) => {
    const offenders = sourceFiles(SRC)
      .filter((file) => readFileSync(file, "utf8").includes(claim))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});
