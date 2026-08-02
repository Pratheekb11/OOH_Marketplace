/**
 * Image loader for the GitHub Pages static export (wired up in
 * next.config.ts, and only when NEXT_OUTPUT=export).
 *
 * Why this file exists: `basePath` is applied automatically to <Link> hrefs
 * and to `_next/*` assets, but NOT to the `src` of a `next/image` with
 * `images.unoptimized`. On a project site served from /<repo>/ that silently
 * turns every `/images/...` into a 404. A custom loader is the supported way
 * to control the emitted URL in an export, so it replaces `unoptimized`
 * rather than accompanying it (`unoptimized` bypasses the loader entirely).
 *
 * Width is deliberately ignored — there is no optimizer behind this, so all
 * candidate widths resolve to the same original file, exactly as
 * `unoptimized` behaved.
 *
 * The var must be NEXT_PUBLIC_-prefixed: this module is bundled into the
 * client, and only public env vars are inlined there.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export interface PagesImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

export default function pagesImageLoader({ src }: PagesImageLoaderParams): string {
  // Absolute and data URLs are already fully qualified.
  if (/^(https?:)?\/\//.test(src) || src.startsWith("data:")) return src;
  return `${BASE_PATH}${src.startsWith("/") ? "" : "/"}${src}`;
}
