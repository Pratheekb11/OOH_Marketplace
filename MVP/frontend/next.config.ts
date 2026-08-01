import type { NextConfig } from "next";

/**
 * Static-export mode, used only by the GitHub Pages workflow
 * (.github/workflows/deploy-pages.yml -> `npm run build:pages`).
 *
 * It is deliberately opt-in via NEXT_OUTPUT=export rather than always-on,
 * because `output: "export"` disables `next start`, the image optimizer and
 * every server-rendering feature. Local `npm run dev` / `npm run build` must
 * keep behaving exactly as they did before Pages entered the picture.
 */
const isExport = process.env.NEXT_OUTPUT === "export";

/**
 * GitHub Pages serves a project site from a sub-path
 * (https://<user>.github.io/<repo>/), so every route and asset URL needs the
 * repo name in front of it. The workflow derives this from the repository
 * name; an empty value is correct for a user/organisation site or any host
 * that serves from the domain root.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Images are served from /public/images — no remote origins yet, so no
  // remotePatterns needed.
  //
  // `next dev` (Turbopack) and `next build` (Webpack) must never share an
  // output directory: a build running while a dev server is up yanks chunk
  // files out from under it, producing `TypeError: Cannot read properties
  // of undefined (reading 'call')` in webpack.js. The dev script sets
  // NEXT_DIST_DIR=.next-dev (see package.json); production/build keeps the
  // default `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  ...(isExport
    ? {
        output: "export" as const,
        // Emit `marketplace/index.html` rather than `marketplace.html`.
        // Both happen to work on Pages, but directory-style output also
        // resolves correctly under `file://` and behind any plain static
        // server, which makes the artifact easier to verify locally.
        trailingSlash: true,
        basePath,
        assetPrefix: basePath || undefined,
        // The optimizer is a server route (`/_next/image`) and there is no
        // server, so image URLs are emitted by a custom loader instead. It
        // replaces `unoptimized` rather than joining it — `unoptimized`
        // bypasses the loader, and then basePath never reaches image srcs.
        // See src/lib/pages-image-loader.ts.
        images: {
          loader: "custom" as const,
          loaderFile: "./src/lib/pages-image-loader.ts",
        },
      }
    : {}),
};

export default nextConfig;
