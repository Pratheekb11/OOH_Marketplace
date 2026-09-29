// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Both Vercel projects share one "Ignored Build Step" script so a deploy only
// happens on demand: a commit on `main` whose message carries `[deploy]`.
// Vercel's contract: exit 0 = skip the build, exit 1 = build.
// `npm test` runs from MVP/frontend.
const repoRoot = path.resolve(process.cwd(), "../..") + "/";
const script = `${repoRoot}scripts/vercel-ignore-build.sh`;

function run(env: Record<string, string>) {
  return spawnSync("bash", [script], {
    env: { PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
  }).status;
}

describe("vercel-ignore-build.sh", () => {
  it("skips an ordinary push to main", () => {
    expect(run({ VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_COMMIT_MESSAGE: "Fix typo" })).toBe(0);
  });

  it("builds a main commit tagged [deploy]", () => {
    expect(run({ VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_COMMIT_MESSAGE: "Ship cart fix [deploy]" })).toBe(1);
  });

  it("skips dependabot branches even when tagged", () => {
    expect(
      run({
        VERCEL_GIT_COMMIT_REF: "dependabot/npm_and_yarn/MVP/frontend/next-15.5.1",
        VERCEL_GIT_COMMIT_MESSAGE: "Bump next [deploy]",
      }),
    ).toBe(0);
  });

  it("skips any other preview branch", () => {
    expect(run({ VERCEL_GIT_COMMIT_REF: "feature/x", VERCEL_GIT_COMMIT_MESSAGE: "wip [deploy]" })).toBe(0);
  });

  it("is wired into both Vercel projects", () => {
    for (const project of ["MVP/frontend", "MVP/backend"]) {
      const cfg = JSON.parse(readFileSync(`${repoRoot}${project}/vercel.json`, "utf8"));
      expect(cfg.ignoreCommand).toBe("bash ../../scripts/vercel-ignore-build.sh");
    }
  });
});

describe("next.config images", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // Listing photos are pre-sized JPEGs; routing ~2,800 of them through
  // /_next/image burns the Hobby plan's image-optimization quota.
  it("serves images unoptimized on Vercel", async () => {
    vi.stubEnv("NEXT_OUTPUT", "");
    const { default: config } = await import("../../next.config");
    expect(config.images?.unoptimized).toBe(true);
  });
});
