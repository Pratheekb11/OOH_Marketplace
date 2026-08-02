import Image from "next/image";
import Icon from "@/components/ui/Icon";
import Money from "@/components/ui/Money";
import type { ListingOut } from "./types";

export interface MapPanelProps {
  listings: ListingOut[];
  className?: string;
}

/**
 * Static map image + pin overlays, ported from listing_page.html's right
 * rail. Presentational only — no maps library, per the build brief. Pin
 * positions are fixed (matching the prototype's hand-placed overlays); pin
 * labels/the "Active View" card pull real numbers from the current result
 * set so it doesn't read as pure fake chrome.
 */
export function MapPanel({ listings, className = "" }: MapPanelProps) {
  const pins = listings.slice(0, 2);
  const avgPerDay =
    listings.length > 0
      ? Math.round(listings.reduce((sum, l) => sum + l.price_per_day, 0) / listings.length)
      : 0;
  const focusListing = listings[0];

  return (
    <section
      className={`relative hidden overflow-hidden border-l border-surface-container bg-surface-container-high md:block ${className}`}
    >
      <div className="absolute inset-0 opacity-80 grayscale">
        <Image
          src="/images/map/bengaluru-static.png"
          alt="Map of Bengaluru"
          fill
          sizes="(min-width: 1280px) 30vw, 40vw"
          className="object-cover"
        />
      </div>

      <div className="absolute right-6 top-6 z-10 flex flex-col gap-2">
        <button
          type="button"
          aria-label="Zoom in"
          className="glass-panel flex h-10 w-10 items-center justify-center rounded-xl text-primary shadow-lg transition-all hover:bg-white"
        >
          <Icon name="add" className="!text-xl" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          className="glass-panel flex h-10 w-10 items-center justify-center rounded-xl text-primary shadow-lg transition-all hover:bg-white"
        >
          <Icon name="remove" className="!text-xl" />
        </button>
        <button
          type="button"
          aria-label="My location"
          className="glass-panel mt-4 flex h-10 w-10 items-center justify-center rounded-xl text-primary shadow-lg transition-all hover:bg-white"
        >
          <Icon name="my_location" className="!text-xl" />
        </button>
      </div>

      {focusListing ? (
        <div className="absolute bottom-6 left-6 right-6 z-10">
          <div className="glass-panel flex items-center gap-4 rounded-xl border border-white/40 p-4 shadow-2xl">
            <div className="flex-1 overflow-hidden">
              <span className="text-[8px] font-black uppercase tracking-widest text-secondary">Active View</span>
              <h4 className="truncate font-headline text-sm font-bold text-primary">{focusListing.location}</h4>
              <p className="truncate text-[9px] text-on-surface-variant">{listings.length} slots available</p>
            </div>
            <div className="shrink-0 rounded-lg border border-white/20 bg-white/50 px-2 py-1 text-center">
              <Money value={avgPerDay} mode="compact" className="block text-[10px] font-bold text-primary" />
              <span className="text-[7px] font-bold uppercase text-outline">Avg/D</span>
            </div>
          </div>
        </div>
      ) : null}

      {pins.map((listing, index) => (
        <div
          key={listing.id}
          className="group absolute z-10 cursor-pointer"
          style={index === 0 ? { top: "33%", left: "50%" } : { top: "66%", right: "25%" }}
        >
          <div className="relative flex flex-col items-center">
            <div
              className={`rounded-full border-2 border-white px-2 py-1 text-[9px] font-bold text-white shadow-xl transition-transform group-hover:scale-110 ${
                index === 0 ? "bg-primary" : "bg-secondary"
              }`}
            >
              <Money value={listing.extra?.display_price ?? listing.price_per_day} mode="compact" />
            </div>
            <div className={`h-2 w-0.5 ${index === 0 ? "bg-primary" : "bg-secondary"}`} />
          </div>
        </div>
      ))}
    </section>
  );
}

export default MapPanel;
