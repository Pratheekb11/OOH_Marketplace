"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import SelectField from "@/components/ui/SelectField";
import TextField from "@/components/ui/TextField";
import type { ListingFacets } from "./types";

const PRICE_BANDS: { label: string; min: string; max: string }[] = [
  { label: "Any Price", min: "", max: "" },
  { label: "Under ₹2,000 / day", min: "", max: "2000" },
  { label: "₹2,000 – 10,000 / day", min: "2000", max: "10000" },
  { label: "₹10,000 – 30,000 / day", min: "10000", max: "30000" },
  { label: "Above ₹30,000 / day", min: "30000", max: "" },
];

// Coarse size bands, for advertisers who think in "big board" rather than in
// exact feet. Complements the exact-size list, which comes from the facets.
const AREA_BANDS: { label: string; min: string; max: string }[] = [
  { label: "Any Size", min: "", max: "" },
  { label: "Small (under 200 sq ft)", min: "", max: "200" },
  { label: "Medium (200 – 800 sq ft)", min: "200", max: "800" },
  { label: "Large (800 – 2,000 sq ft)", min: "800", max: "2000" },
  { label: "Extra Large (2,000+ sq ft)", min: "2000", max: "" },
];

const SORT_OPTIONS = [
  { value: "footfall_desc", label: "Footfall (High to Low)" },
  { value: "price_asc", label: "Price (Low to High)" },
  { value: "price_desc", label: "Price (High to Low)" },
  { value: "size_desc", label: "Size (Large to Small)" },
  { value: "size_asc", label: "Size (Small to Large)" },
  { value: "newest", label: "Newest First" },
];

/** Query keys this bar owns. Everything here is cleared by "Clear", and any
 * change resets paging — otherwise you land on page 5 of a 2-result filter. */
const FILTER_KEYS = [
  "q", "space_type", "lighting", "min_price", "max_price",
  "size", "min_area", "max_area", "min_footfall",
] as const;

/**
 * Reads/writes the listing query onto the URL so filters are shareable and
 * back/forward works. Uses useSearchParams(), so the caller MUST wrap this
 * in <Suspense>.
 *
 * Dropdown contents come from GET /listings/facets rather than a hardcoded
 * list: the catalogue is scraped inventory that changes per import, and a
 * static list silently offers filters that match nothing.
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
  const size = searchParams.get("size") ?? "";
  const minArea = searchParams.get("min_area") ?? "";
  const maxArea = searchParams.get("max_area") ?? "";
  const sort = searchParams.get("sort") ?? "footfall_desc";

  const [qInput, setQInput] = useState(q);
  const [facets, setFacets] = useState<ListingFacets | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<ListingFacets>("/listings/facets")
      .then((data) => {
        if (!cancelled) setFacets(data);
      })
      // A facets failure must not break browsing; the selects just fall back
      // to whatever is already in the URL.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the local text field in sync when the URL changes from elsewhere.
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
      next.delete("offset"); // any filter change returns to the first page
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
  const activeAreaBand =
    AREA_BANDS.find((band) => band.min === minArea && band.max === maxArea) ?? AREA_BANDS[0];

  const hasActiveFilters = FILTER_KEYS.some((key) => searchParams.get(key));

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
          {(facets?.space_types ?? []).map((type) => (
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
          {(facets?.lightings ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Dimensions (in feet)"
          containerClassName="gap-1"
          className="!p-2 min-w-[150px] text-sm font-medium"
          value={size}
          onChange={(e) => updateParams({ size: e.target.value, min_area: "", max_area: "" })}
        >
          <option value="">Any Dimensions</option>
          {(facets?.sizes ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Size Band"
          containerClassName="gap-1"
          className="!p-2 min-w-[170px] text-sm font-medium"
          value={activeAreaBand.label}
          onChange={(e) => {
            const band = AREA_BANDS.find((b) => b.label === e.target.value) ?? AREA_BANDS[0];
            // Exact size and an area band contradict each other; the band wins.
            updateParams({ min_area: band.min, max_area: band.max, size: "" });
          }}
        >
          {AREA_BANDS.map((band) => (
            <option key={band.label} value={band.label}>
              {band.label}
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

        {hasActiveFilters && (
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
