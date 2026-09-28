"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { inrCompact } from "@/lib/format";
import { currentMapsProvider, directionsUrl } from "@/lib/map/directions";
import { toMapPoints, type MapPoint } from "@/lib/map/points";
import type { ListingOut } from "./types";

export interface MapPanelProps {
  listings: ListingOut[];
  className?: string;
}

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Central Bengaluru, used only until the first result set arrives. */
const INITIAL_VIEW: [number, number] = [12.9716, 77.5946];

// OpenStreetMap's standard tiles: keyless, and fine for this traffic under
// OSM's tile usage policy as long as the attribution stays visible. CARTO's
// basemaps were tried first and now answer an unregistered site with an
// "API KEY REQUIRED" tile. The .adspace-map-tiles filter in globals.css
// greys them so the navy pins carry the page.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Popup body built as DOM nodes, so a title is always text and never markup. */
function popupContent(point: MapPoint, listing: ListingOut): HTMLElement {
  const root = document.createElement("div");
  root.className = "adspace-map-popup";

  const title = document.createElement("p");
  title.className = "adspace-map-popup__title";
  title.textContent = point.title;

  const price = document.createElement("p");
  price.className = "adspace-map-popup__price";
  price.textContent = `${inrCompact(point.price)} / day`;

  const link = document.createElement("a");
  link.className = "adspace-map-popup__link";
  link.href = `${BASE_PATH}/listings/${point.id}`;
  link.textContent = "View space →";

  root.append(title, price, link);

  const directions = directionsUrl(listing, currentMapsProvider());
  if (directions) {
    const navigate = document.createElement("a");
    navigate.className = "adspace-map-popup__link";
    navigate.href = directions;
    navigate.target = "_blank";
    navigate.rel = "noopener noreferrer";
    navigate.textContent = "Navigate ↗";
    root.append(navigate);
  }
  return root;
}

/**
 * The marketplace's map rail: a Leaflet map with one pin per result that has
 * coordinates (`extra.latitude` / `extra.longitude`), framed to fit them.
 *
 * Leaflet touches `window` at import time, so it is loaded inside an effect
 * rather than at module scope — this component still prerenders on the
 * server and in the static Pages export.
 */
export function MapPanel({ listings, className = "" }: MapPanelProps) {
  const points = useMemo(() => toMapPoints(listings), [listings]);
  const byId = useMemo(() => new Map(listings.map((listing) => [listing.id, listing])), [listings]);

  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((module) => {
      const L = (module as unknown as { default?: typeof Leaflet }).default ?? (module as typeof Leaflet);
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(INITIAL_VIEW, 11);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19, className: "adspace-map-tiles" }).addTo(map);

      leafletRef.current = L;
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  // Redraw pins whenever the result set changes.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();
    for (const point of points) {
      const icon = L.divIcon({
        className: "adspace-map-pin",
        html: `<span>${inrCompact(point.price)}</span>`,
        iconSize: undefined,
      });
      L.marker([point.lat, point.lng], { icon, title: point.title, riseOnHover: true })
        .bindPopup(popupContent(point, byId.get(point.id)!))
        .addTo(layer);
    }

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [40, 40],
        maxZoom: 15,
      });
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
    }
  }, [ready, points, byId]);

  const unmapped = listings.length - points.length;

  return (
    <section
      className={`relative isolate hidden overflow-clip border-l border-surface-container bg-surface-container-high md:block ${className}`}
      aria-label="Map of results"
    >
      {/* The section stretches to the full height of the results column (the
          page scrolls, not the pane), so the map itself is pinned to the
          viewport below the sticky filter bar; otherwise fitBounds would
          frame the pins across thousands of pixels, mostly off-screen. */}
      <div className="sticky top-24 h-[calc(100vh-6rem)]">
        <div ref={containerRef} className="absolute inset-0" />

        {listings.length > 0 && points.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-6 top-6 z-[1000] border border-border-subtle bg-white px-4 py-3 text-xs text-on-surface-variant">
            No mapped locations for these results yet.
          </div>
        ) : unmapped > 0 ? (
          <div className="pointer-events-none absolute bottom-6 left-6 z-[1000] border border-border-subtle bg-white px-3 py-2 text-[11px] text-on-surface-variant">
            {points.length.toLocaleString("en-IN")} of {listings.length.toLocaleString("en-IN")} shown on the map
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default MapPanel;
