import ListingDetailClient from "./ListingDetailClient";

/**
 * `output: "export"` refuses to build a dynamic segment unless every path is
 * enumerable at build time, and the CI runner has no database to enumerate
 * from. So the export pre-renders a fixed band of ids; each one is only an
 * empty shell that fetches its own listing in the browser, so a shell is a
 * few KB and the content is always live.
 *
 * Ids above the band resolve to Pages' 404.html. Raise
 * NEXT_EXPORT_LISTING_IDS in the workflow if the demo database ever grows
 * past it. Outside export mode this function is ignored and any id is served
 * on demand.
 */
export function generateStaticParams() {
  const count = Number(process.env.NEXT_EXPORT_LISTING_IDS ?? 60);
  return Array.from({ length: count }, (_, i) => ({ id: String(i + 1) }));
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingDetailClient id={id} />;
}
