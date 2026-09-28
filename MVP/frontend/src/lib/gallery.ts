import type { ListingOut } from "@/components/marketplace/types";

/** Slots in the listing page's bento gallery. */
export const GALLERY_SLOTS = 4;

// The prototype's two-image bento gallery extras (listing_view.html) only
// exist for the MG Road Premium Unipole seed listing — matched by its
// marketplace-card image path rather than a hardcoded id, since seed ids
// shift across re-seeds. A 3rd gallery image (mg-road-unipole-3.png) is one
// of the 3 prototype images that rotted and was never downloaded, so that
// slot is deliberately left out here and falls back to the placeholder tile.
const EXTRA_GALLERY: Record<string, string[]> = {
  "/images/listings/mg-road-premium-unipole.png": [
    "/images/gallery/mg-road-unipole-1.png",
    "/images/gallery/mg-road-unipole-2.png",
  ],
};

/**
 * Every photo of a listing, cover first. `image_urls` is the API's gallery;
 * a static snapshot exported before it existed only has `image_url`.
 */
export function galleryImages(listing: Pick<ListingOut, "image_url" | "image_urls">): string[] {
  const photos = listing.image_urls?.length
    ? listing.image_urls
    : [listing.image_url, ...(EXTRA_GALLERY[listing.image_url ?? ""] ?? [])];
  return photos.filter((src): src is string => Boolean(src)).slice(0, GALLERY_SLOTS);
}
