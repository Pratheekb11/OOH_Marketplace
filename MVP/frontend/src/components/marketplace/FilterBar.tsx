"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import SelectField from "@/components/ui/SelectField";
import TextField from "@/components/ui/TextField";

// Ad Options list lifted from listing_page.html's filter dropdown, extended
// with the one space_type the seed data uses that the prototype dropdown
// didn't enumerate (the MG Road Premium Unipole detail listing).
const SPACE_TYPES = [
  "Bus Shelter",
  "Hoarding",
  "Digital OOH",
  "Digital Bus Shelter",
  "Skywalk",
  "Transit",
  "Premium Front-Facing Billboard",
];

const LIGHTING_OPTIONS = ["Non Lit", "Back Lit", "Front Lit", "LED"];

// The prototype's "Dimensions (in feet)" dropdown has no backend equivalent
// (GET /listings only supports min_price/max_price, not width/height) — a
// price-band select over the real query params is the closest honest match.
const PRICE_BANDS: { label: string; min: string; max: string }[] = [
  { label: "Any Price", min: "", max: "" },
  { label: "Under ₹2,000 / day", min: "", max: "2000" },
  { label: "₹2,000 – 10,000 / day", min: "2000", max: "10000" },
  { label: "₹10,000 – 30,000 / day", min: "10000", max: "30000" },
  { label: "Above ₹30,000 / day", min: "30000", max: "" },
];

const SORT_OPTIONS = [
  { value: "footfall_desc", label: "Footfall (High to Low)" },
  { value: "price_asc", label: "Price (Low to High)" },
];

/**
 * Reads/writes ?q=&space_type=&lighting=&min_price=&max_price=&sort= on the
 * URL so filters are shareable and back/forward works. Uses
 * useSearchParams(), so the caller MUST wrap this in <Suspense>.
 */
export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const spaceType = searchParams.get("space_type") ?? "";
  const lighting = searchParams.get("lighting") ?? "";
  const minPrice = searchParams.get("min_price") ?? "";
  const maxPrice = searchParams.get("max_price") ?? "";
  const sort = searchParams.get("sort") ?? "footfall_desc";

  const [qInput, setQInput] = useState(q);

  // Keep the local text field in sync when the URL changes from elsewhere
  // (back/forward navigation, "clear filters" elsewhere on the page).
  useEffect(() => {
    setQInput(q);
  }, [q]);

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams],
  );

  // Debounce the free-text search so we don't re-query on every keystroke.
  useEffect(() => {
    if (qInput === q) return;
    const timer = setTimeout(() => updateParams({ q: qInput }), 400);
    return () => clearTimeout(timer);
  }, [qInput, q, updateParams]);

  const activePriceBand =
    PRICE_BANDS.find((band) => band.min === minPrice && band.max === maxPrice) ?? PRICE_BANDS[0];

  return (
    <section className="sticky top-0 z-40 border-b border-surface-container bg-surface-container-lowest px-8 py-4 shadow-sm">
      <div className="mx-auto flex max-w-full flex-wrap items-center gap-6">
        <div className="flex min-w-[200px] flex-col gap-1">
          <TextField
            label="Location"
            containerClassName="gap-1"
            className="!p-2 pr-8 text-sm"
            placeholder="Search areas or titles..."
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>

        <SelectField
          label="Ad Options"
          containerClassName="gap-1"
          className="!p-2 min-w-[160px] text-sm font-medium"
          value={spaceType}
          onChange={(e) => updateParams({ space_type: e.target.value })}
        >
          <option value="">All Options</option>
          {SPACE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Lighting"
          containerClassName="gap-1"
          className="!p-2 min-w-[140px] text-sm font-medium"
          value={lighting}
          onChange={(e) => updateParams({ lighting: e.target.value })}
        >
          <option value="">All Types</option>
          {LIGHTING_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Price Range"
          containerClassName="gap-1"
          className="!p-2 min-w-[160px] text-sm font-medium"
          value={activePriceBand.label}
          onChange={(e) => {
            const band = PRICE_BANDS.find((b) => b.label === e.target.value) ?? PRICE_BANDS[0];
            updateParams({ min_price: band.min, max_price: band.max });
          }}
        >
          {PRICE_BANDS.map((band) => (
            <option key={band.label} value={band.label}>
              {band.label}
            </option>
          ))}
        </SelectField>

        <div className="mx-2 h-10 w-px bg-outline-variant" />

        <SelectField
          label="Sort By"
          containerClassName="ml-auto gap-1"
          className="!p-0 border-none bg-transparent text-sm font-bold text-primary"
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        {(q || spaceType || lighting || minPrice || maxPrice) && (
          <button
            type="button"
            onClick={() => {
              setQInput("");
              router.replace(pathname);
            }}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
          >
            <Icon name="close" className="!text-sm" />
            Clear
          </button>
        )}
      </div>
    </section>
  );
}

export default FilterBar;
