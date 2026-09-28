import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ListingOut } from "./types";

/**
 * Leaflet needs a real layout engine, which jsdom does not have, so the
 * module is replaced with recording stubs. Every factory returns a
 * chainable object whose methods record their arguments by name.
 */
const leaflet = vi.hoisted(() => {
  const record: Record<string, unknown[][]> = {};
  const chain = (): unknown =>
    new Proxy(function stub() {}, {
      get(_target, prop) {
        if (prop === "then") return undefined;
        return (...args: unknown[]) => {
          (record[String(prop)] ??= []).push(args);
          return chain();
        };
      },
      apply: () => chain(),
      construct: () => chain() as object,
    });
  const factory = (name: string) => (...args: unknown[]) => {
    (record[`L.${name}`] ??= []).push(args);
    return chain();
  };
  const L = {
    map: factory("map"),
    tileLayer: factory("tileLayer"),
    marker: factory("marker"),
    circleMarker: factory("circleMarker"),
    layerGroup: factory("layerGroup"),
    featureGroup: factory("featureGroup"),
    latLng: factory("latLng"),
    latLngBounds: factory("latLngBounds"),
    divIcon: factory("divIcon"),
    icon: factory("icon"),
    popup: factory("popup"),
    point: factory("point"),
    control: Object.assign(factory("control"), {
      zoom: factory("control.zoom"),
      attribution: factory("control.attribution"),
      scale: factory("control.scale"),
    }),
  };
  return { record, L };
});

vi.mock("leaflet", () => ({ ...leaflet.L, default: leaflet.L }));

import MapPanel from "./MapPanel";

function listing(id: number, extra: ListingOut["extra"], title = `Listing ${id}`): ListingOut {
  return {
    id,
    owner_id: 1,
    title,
    space_type: "Hoarding",
    description: "",
    location: "Bengaluru",
    width_ft: 40,
    height_ft: 20,
    price_per_day: 5000,
    footfall_estimate: null,
    status: "active",
    rejection_reason: null,
    lighting: null,
    image_url: null,
    extra,
  };
}

function popupMarkup(): string {
  return (leaflet.record.bindPopup ?? [])
    .map(([content]) => (typeof content === "string" ? content : (content as HTMLElement)?.outerHTML ?? ""))
    .join("\n");
}

beforeEach(() => {
  for (const key of Object.keys(leaflet.record)) delete leaflet.record[key];
});

afterEach(() => cleanup());

describe("MapPanel (P0-4)", () => {
  it("no longer renders the static Bengaluru picture", () => {
    const { container } = render(
      <MapPanel listings={[listing(1, { latitude: 12.97, longitude: 77.59 })]} />,
    );
    const images = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src") ?? "");
    expect(images.some((src) => src.includes("bengaluru-static"))).toBe(false);
  });

  it("does not render its own decorative zoom / location buttons", () => {
    render(<MapPanel listings={[listing(1, { latitude: 12.97, longitude: 77.59 })]} />);
    expect(screen.queryByRole("button", { name: /zoom in/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /zoom out/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /my location/i })).toBeNull();
  });

  it("creates one real map with a marker per mappable listing", async () => {
    render(
      <MapPanel
        listings={[
          listing(1, { latitude: 12.97, longitude: 77.59 }),
          listing(2, null),
          listing(3, { latitude: "12.93", longitude: "77.62" }),
        ]}
      />,
    );

    await waitFor(() => expect(leaflet.record["L.marker"]?.length).toBe(2));
    expect(leaflet.record["L.map"]).toHaveLength(1);
    expect(leaflet.record["L.tileLayer"]?.length ?? 0).toBeGreaterThanOrEqual(1);

    const positions = leaflet.record["L.marker"].map(([latlng]) => latlng);
    expect(positions).toEqual([
      [12.97, 77.59],
      [12.93, 77.62],
    ]);
  });

  it("frames the markers instead of a fixed view", async () => {
    render(
      <MapPanel
        listings={[
          listing(1, { latitude: 12.97, longitude: 77.59 }),
          listing(3, { latitude: 12.93, longitude: 77.62 }),
        ]}
      />,
    );
    await waitFor(() => expect(leaflet.record.fitBounds?.length ?? 0).toBeGreaterThanOrEqual(1));
  });

  it("links each marker's popup to its listing page", async () => {
    render(<MapPanel listings={[listing(42, { latitude: 12.97, longitude: 77.59 }, "MG Road Unipole")]} />);
    await waitFor(() => expect(leaflet.record.bindPopup?.length ?? 0).toBeGreaterThanOrEqual(1));
    const markup = popupMarkup();
    expect(markup).toContain("MG Road Unipole");
    expect(markup).toContain("/listings/42");
  });

  it("escapes listing titles in popups", async () => {
    render(
      <MapPanel listings={[listing(7, { latitude: 12.97, longitude: 77.59 }, '<img src=x onerror="alert(1)">')]} />,
    );
    await waitFor(() => expect(leaflet.record.bindPopup?.length ?? 0).toBeGreaterThanOrEqual(1));
    expect(popupMarkup()).not.toContain("<img src=x");
  });

  it("says so when none of the results have coordinates", async () => {
    render(<MapPanel listings={[listing(1, null), listing(2, {})]} />);
    expect(await screen.findByText(/no mapped locations/i)).toBeTruthy();
    expect(leaflet.record["L.marker"]).toBeUndefined();
  });

  it("tears the map down on unmount", async () => {
    const { unmount } = render(<MapPanel listings={[listing(1, { latitude: 12.97, longitude: 77.59 })]} />);
    await waitFor(() => expect(leaflet.record["L.map"]).toHaveLength(1));
    unmount();
    expect(leaflet.record.remove?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe("MapPanel directions", () => {
  it("offers turn-by-turn directions from each marker's popup", async () => {
    render(<MapPanel listings={[listing(42, { latitude: 12.97, longitude: 77.59 }, "MG Road Unipole")]} />);
    await waitFor(() => expect(leaflet.record.bindPopup?.length ?? 0).toBeGreaterThanOrEqual(1));
    const popup = leaflet.record.bindPopup[0][0] as HTMLElement;
    const link = [...popup.querySelectorAll("a")].find((a) => /navigate/i.test(a.textContent ?? ""));
    expect(link).toBeTruthy();
    const url = new URL(link!.getAttribute("href")!);
    expect(url.hostname).toBe("www.google.com");
    expect(url.searchParams.get("destination")).toBe("12.97,77.59");
    expect(link!.getAttribute("target")).toBe("_blank");
  });
});
