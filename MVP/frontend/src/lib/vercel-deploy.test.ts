// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Both Vercel projects skip every build unless it was asked for: a commit on
// `main` whose message carries `[deploy]`. Vercel's contract for
// `ignoreCommand`: exit 0 = skip the build, exit 1 = build.
//
// The command is inline in each vercel.json and must not reach outside the
// project's root directory: the backend project is cloned without the rest
// of the repo, and a shared ../../scripts/ file failed there with exit 127.
// `npm test` runs from MVP/frontend.
const repoRoot = path.resolve(process.cwd(), "../..") + "/";
const projects = ["MVP/frontend", "MVP/backend"];

function ignoreCommand(project: string): string {
  return JSON.parse(readFileSync(`${repoRoot}${project}/vercel.json`, "utf8")).ignoreCommand;
}

function run(project: string, env: Record<string, string>) {
  return spawnSync("sh", ["-c", ignoreCommand(project)], {
    cwd: `${repoRoot}${project}`,
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", ...env },
    encoding: "utf8",
  }).status;
}

describe.each(projects)("%s ignoreCommand", (project) => {
  it("is self-contained", () => {
    const cmd = ignoreCommand(project);
    expect(cmd).toBeTruthy();
    expect(cmd).not.toContain("..");
    expect(cmd.length).toBeLessThanOrEqual(256);
  });

  it("skips an ordinary push to main", () => {
    expect(run(project, { VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_COMMIT_MESSAGE: "Fix typo" })).toBe(0);
  });

  it("builds a main commit tagged [deploy]", () => {
    expect(run(project, { VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_COMMIT_MESSAGE: "Ship cart fix [deploy]" })).toBe(1);
  });

  it("skips dependabot branches even when tagged", () => {
    expect(
      run(project, {
        VERCEL_GIT_COMMIT_REF: "dependabot/pip/MVP/backend/backend-minor-and-patch-73f7fb1575",
        VERCEL_GIT_COMMIT_MESSAGE: "Bump the backend group [deploy]",
      }),
    ).toBe(0);
  });

  it("skips any other preview branch", () => {
    expect(run(project, { VERCEL_GIT_COMMIT_REF: "feature/x", VERCEL_GIT_COMMIT_MESSAGE: "wip [deploy]" })).toBe(0);
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
