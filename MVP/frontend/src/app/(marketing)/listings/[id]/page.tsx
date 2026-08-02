import { readFileSync } from "node:fs";
import { join } from "node:path";
import ListingDetailClient from "./ListingDetailClient";

/**
 * `output: "export"` refuses to build a dynamic segment unless every path is
 * enumerable at build time, and the CI runner has no database to enumerate
 * from. The static snapshot in `public/data/listings.json` is the enumeration:
 * it ships with the build and already lists every active listing, so the pages
 * and the catalogue cannot drift apart the way a hardcoded count does.
 *
 * Each page is only an empty shell that fetches its own listing in the browser
 * (from the API, or the same snapshot when there is no API), so a shell is a
 * few KB and the content is never stale.
 *
 * Falls back to a fixed band when the snapshot is missing — regenerate it with
 * `python -m scripts.export_static` from MVP/backend. Outside export mode this
 * function is ignored and any id is served on demand.
 */
export function generateStaticParams() {
  try {
    const path = join(process.cwd(), "public", "data", "listings.json");
    const listings = JSON.parse(readFileSync(path, "utf8")) as { id: number }[];
    if (listings.length) return listings.map((listing) => ({ id: String(listing.id) }));
  } catch {
    // No snapshot committed (or unreadable) — fall through to the id band.
  }
  const count = Number(process.env.NEXT_EXPORT_LISTING_IDS ?? 60);
  return Array.from({ length: count }, (_, i) => ({ id: String(i + 1) }));
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingDetailClient id={id} />;
}
