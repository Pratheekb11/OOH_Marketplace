import Icon from "@/components/ui/Icon";
import type { ListingOut } from "@/components/marketplace/types";

export interface StatsGridProps {
  listing: ListingOut;
}

function formatFootfall(value: number | null): string {
  if (!value) return "—";
  return `${value.toLocaleString("en-IN")}+`;
}

/** Ported from listing_view.html's 4-tile stats grid. `extra` is a freeform
 * JSON blob only the seeded MG Road Premium Unipole listing populates fully
 * — Visibility/Peak Hours fall back to an em dash for every other listing. */
export function StatsGrid({ listing }: StatsGridProps) {
  const stats = [
    { icon: "group", label: "Daily Footfall", value: formatFootfall(listing.footfall_estimate) },
    {
      icon: "straighten",
      label: "Size",
      // Not every space publishes dimensions (bus shelters are sold by a
      // size bucket), so fall back rather than rendering "nullxnull ft".
      value:
        listing.width_ft && listing.height_ft
          ? `${listing.width_ft}x${listing.height_ft} ft`
          : (typeof listing.extra?.size_bucket === "string" && listing.extra.size_bucket) || "—",
    },
    { icon: "visibility", label: "Visibility", value: listing.extra?.visibility_radius ?? "—" },
    { icon: "schedule", label: "Peak Hours", value: listing.extra?.peak_hours ?? "—" },
  ];

  return (
    <section className="grid grid-cols-2 gap-6 md:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl bg-surface-container-low p-6">
          <Icon name={stat.icon} className="mb-3 !text-3xl text-secondary" />
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">{stat.label}</p>
          <h4 className="text-2xl font-black">{stat.value}</h4>
        </div>
      ))}
    </section>
  );
}

export default StatsGrid;
