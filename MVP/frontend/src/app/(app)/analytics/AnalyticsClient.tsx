"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import RequireRole from "@/components/auth/RequireRole";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import Money from "@/components/ui/Money";
import Skeleton from "@/components/ui/Skeleton";
import { ADDON_META } from "@/lib/addons";
import { api } from "@/lib/api";
import { formatIsoDate } from "@/lib/format";
import type { ListingOut } from "@/components/marketplace/types";
import type { AddonCode } from "@/lib/addons";
import type { Booking } from "@/types/api";

/**
 * Ported from Ui_Prototype_MVP_Prep/Campaign_analytics.html — but the
 * prototype's numbers (4.2M reach, 12.4% trend, CPM ₹4.12, 842k weekly
 * reach, "48 active displays") are all hand-authored fake copy with nothing
 * behind them. There is no analytics/impression-tracking backend in this
 * build. Rather than reproduce those as if they were real, every figure on
 * this page is derived from the signed-in advertiser's actual
 * `GET /bookings` + `GET /listings/{id}` data (dates, spend, add-ons,
 * status). Metrics with no real data source (impressions, reach, footfall
 * delivered, CTR, engagement) are rendered in the "Not instrumented" section
 * near the bottom, visibly marked as such, instead of being invented.
 */

type CampaignPhase = "upcoming" | "active" | "completed";

interface EnrichedBooking extends Booking {
  listing?: ListingOut;
  phase: CampaignPhase;
}

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function phaseOf(booking: Booking, today: string): CampaignPhase {
  if (booking.start_date > today) return "upcoming";
  if (booking.end_date < today) return "completed";
  return "active";
}

const PHASE_META: Record<CampaignPhase, { label: string; tone: "primary" | "secondary" | "tertiary" }> = {
  active: { label: "Active", tone: "secondary" },
  upcoming: { label: "Upcoming", tone: "primary" },
  completed: { label: "Completed", tone: "tertiary" },
};

function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[m - 1]} '${String(y).slice(2)}`;
}

/** Builds and downloads a CSV of the advertiser's real booking data
 * client-side — a genuine "Export Report" rather than the prototype's inert
 * button, with no server endpoint required. */
function exportCsv(bookings: EnrichedBooking[]) {
  const header = [
    "booking_id",
    "listing",
    "location",
    "start_date",
    "end_date",
    "base_amount",
    "addons_amount",
    "gst_amount",
    "total_amount",
    "status",
  ];
  const escape = (value: string) => (value.includes(",") || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value);
  const rows = bookings.map((b) => [
    String(b.id),
    escape(b.listing?.title ?? `Listing #${b.listing_id}`),
    escape(b.listing?.location ?? ""),
    b.start_date,
    b.end_date,
    b.base_amount.toFixed(2),
    b.addons_amount.toFixed(2),
    b.gst_amount.toFixed(2),
    b.total_amount.toFixed(2),
    b.status,
  ]);
  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "adspace-bookings.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Small listing thumbnail with the same broken-image degrade used by
 * ListingCard/CartItemRow — analytics rows reference listings whose image
 * may 404 or whose fetch failed entirely. */
function ListingThumb({ listing, title }: { listing?: ListingOut; title: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(listing?.image_url) && !failed;
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-container-high">
      {showImage ? (
        <Image
          src={listing!.image_url as string}
          alt={title}
          fill
          sizes="56px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="brand-gradient flex h-full w-full items-center justify-center text-white/90">
          <Icon name="image" className="!text-lg" />
        </div>
      )}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-96" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-3xl" />
      <Skeleton className="h-80 w-full rounded-3xl" />
    </div>
  );
}

function AnalyticsBody() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [listings, setListings] = useState<Record<number, ListingOut>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api<Booking[]>("/bookings")
      .then(async (data) => {
        if (cancelled) return;
        setBookings(data);
        const ids = Array.from(new Set(data.map((b) => b.listing_id)));
        const results = await Promise.all(
          ids.map((id) =>
            api<ListingOut>(`/listings/${id}`)
              .then((listing) => [id, listing] as const)
              .catch(() => null),
          ),
        );
        if (cancelled) return;
        const map: Record<number, ListingOut> = {};
        for (const result of results) {
          if (result) map[result[0]] = result[1];
        }
        setListings(map);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your booking data. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enriched = useMemo<EnrichedBooking[]>(() => {
    if (!bookings) return [];
    const today = todayIsoLocal();
    return bookings
      .filter((b) => b.status !== "cancelled")
      .map((b) => ({ ...b, listing: listings[b.listing_id], phase: phaseOf(b, today) }));
  }, [bookings, listings]);

  const stats = useMemo(() => {
    const totalSpend = enriched.reduce((sum, b) => sum + b.total_amount, 0);
    const totalBase = enriched.reduce((sum, b) => sum + b.base_amount, 0);
    const totalAddons = enriched.reduce((sum, b) => sum + b.addons_amount, 0);
    const totalGst = enriched.reduce((sum, b) => sum + b.gst_amount, 0);

    const phaseCounts: Record<CampaignPhase, number> = { active: 0, upcoming: 0, completed: 0 };
    for (const b of enriched) phaseCounts[b.phase] += 1;

    const listingTotals = new Map<number, { listing?: ListingOut; total: number; count: number }>();
    for (const b of enriched) {
      const entry = listingTotals.get(b.listing_id) ?? { listing: b.listing, total: 0, count: 0 };
      entry.total += b.total_amount;
      entry.count += 1;
      entry.listing = entry.listing ?? b.listing;
      listingTotals.set(b.listing_id, entry);
    }
    const spendByListing = Array.from(listingTotals.entries())
      .map(([listingId, v]) => ({ listingId, ...v }))
      .sort((a, b) => b.total - a.total);

    const monthTotals = new Map<string, number>();
    for (const b of enriched) {
      const key = monthKey(b.start_date);
      monthTotals.set(key, (monthTotals.get(key) ?? 0) + b.total_amount);
    }
    const spendByMonth = Array.from(monthTotals.entries())
      .map(([key, total]) => ({ key, total }))
      .sort((a, b) => (a.key < b.key ? -1 : 1));

    const addonTotals = new Map<AddonCode, { count: number; amount: number }>();
    for (const b of enriched) {
      for (const line of b.addons ?? []) {
        const code = line.code as AddonCode;
        const entry = addonTotals.get(code) ?? { count: 0, amount: 0 };
        entry.count += 1;
        entry.amount += line.price;
        addonTotals.set(code, entry);
      }
    }

    const starts = enriched.map((b) => b.start_date).sort();
    const ends = enriched.map((b) => b.end_date).sort();
    const windowStart = starts[0];
    const windowEnd = ends[ends.length - 1];

    const uniqueListingCount = listingTotals.size;

    return {
      totalSpend,
      totalBase,
      totalAddons,
      totalGst,
      phaseCounts,
      spendByListing,
      spendByMonth,
      addonTotals,
      windowStart,
      windowEnd,
      uniqueListingCount,
    };
  }, [enriched]);

  if (error) {
    return (
      <EmptyState
        icon="error"
        title="Couldn't load campaign data"
        description={error}
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (bookings === null) {
    return <AnalyticsSkeleton />;
  }

  if (enriched.length === 0) {
    return (
      <EmptyState
        icon="query_stats"
        title="No campaigns yet"
        description="Book a listing to start seeing real spend, schedule, and add-on analytics here."
        action={
          <Button variant="gradient" href="/marketplace">
            Browse the marketplace
          </Button>
        }
      />
    );
  }

  const maxMonthSpend = Math.max(...stats.spendByMonth.map((m) => m.total), 1);
  const maxListingSpend = Math.max(...stats.spendByListing.map((l) => l.total), 1);
  const moneySegments: { key: string; label: string; amount: number; className: string }[] = [
    { key: "base", label: "Base rate", amount: stats.totalBase, className: "bg-primary" },
    { key: "addons", label: "Add-ons", amount: stats.totalAddons, className: "bg-secondary" },
    { key: "gst", label: "GST (18%)", amount: stats.totalGst, className: "bg-tertiary-container" },
  ];

  return (
    <div className="space-y-12">
      {/* ================= HEADER ================= */}
      <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 font-headline text-4xl font-extrabold tracking-tighter text-on-surface md:text-5xl">
            Campaign Intelligence
          </h1>
          <p className="max-w-2xl text-lg text-on-surface-variant">
            Real performance data across {enriched.length} booking{enriched.length === 1 ? "" : "s"} on{" "}
            {stats.uniqueListingCount} listing{stats.uniqueListingCount === 1 ? "" : "s"}
            {stats.windowStart && stats.windowEnd
              ? ` · ${formatIsoDate(stats.windowStart)} – ${formatIsoDate(stats.windowEnd)}`
              : null}
            .
          </p>
        </div>
        <Button variant="primary" onClick={() => exportCsv(enriched)} className="shrink-0 rounded-full">
          <Icon name="download" className="!text-lg" />
          Export bookings (CSV)
        </Button>
      </section>

      {/* ================= PHASE + SPEND KPIs ================= */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-3xl border-t-2 border-secondary-container bg-surface-container-lowest p-8 shadow-sm">
          <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-secondary">Total spend</span>
          <Money value={stats.totalSpend} mode="full" className="font-headline text-4xl font-extrabold tracking-tighter text-on-surface" />
          <p className="mt-2 text-sm text-on-surface-variant">Across all non-cancelled bookings, GST included.</p>
        </div>

        <div className="rounded-3xl bg-surface-container-low p-8">
          <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Campaign status
          </span>
          <div className="flex items-end gap-6">
            {(["active", "upcoming", "completed"] as CampaignPhase[]).map((phase) => (
              <div key={phase}>
                <div className="font-headline text-3xl font-extrabold text-on-surface">{stats.phaseCounts[phase]}</div>
                <Badge tone={PHASE_META[phase].tone} className="mt-1">
                  {PHASE_META[phase].label}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-primary-container p-8 text-white">
          <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-on-primary-container">
            GST paid
          </span>
          <Money value={stats.totalGst} mode="full" className="font-headline text-3xl font-extrabold" />
          <p className="mt-2 text-sm text-on-primary-container">
            {stats.totalSpend > 0 ? Math.round((stats.totalGst / stats.totalSpend) * 100) : 0}% of total spend, per the
            flat 18% rate.
          </p>
        </div>
      </section>

      {/* ================= WHERE YOUR MONEY WENT ================= */}
      <section className="rounded-3xl bg-surface-container-lowest p-8 shadow-sm md:p-10">
        <h3 className="mb-6 font-headline text-xl font-bold">Where your money went</h3>
        <div className="flex h-4 w-full divide-x-2 divide-white overflow-hidden rounded-full bg-surface-container-highest">
          {moneySegments.map((seg) => (
            <div
              key={seg.key}
              title={`${seg.label}: ${seg.amount.toFixed(2)}`}
              className={seg.className}
              style={{ width: `${stats.totalSpend > 0 ? (seg.amount / stats.totalSpend) * 100 : 0}%` }}
            />
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-8">
          {moneySegments.map((seg) => (
            <div key={seg.key} className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${seg.className}`} />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{seg.label}</p>
                <Money value={seg.amount} mode="full" className="font-headline text-sm font-bold text-on-surface" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= SPEND BY MONTH ================= */}
      {stats.spendByMonth.length > 1 ? (
        <section className="rounded-3xl bg-surface-container-low p-8 md:p-10">
          <h3 className="mb-8 font-headline text-xl font-bold">Spend by month</h3>
          <div className="flex h-48 items-end gap-4">
            {stats.spendByMonth.map((m) => (
              <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-bold text-on-surface-variant">
                  <Money value={m.total} mode="compact" />
                </span>
                <div
                  title={`${monthLabel(m.key)}: ${m.total.toFixed(2)}`}
                  className="w-full rounded-t-lg bg-primary-container/60"
                  style={{ height: `${Math.max((m.total / maxMonthSpend) * 100, 4)}%` }}
                />
                <span className="text-[10px] font-bold uppercase text-on-surface-variant">{monthLabel(m.key)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ================= SPEND BY LISTING ================= */}
      <section className="rounded-3xl bg-surface-container-lowest p-8 shadow-sm md:p-10">
        <h3 className="mb-8 font-headline text-xl font-bold">Spend by listing</h3>
        <div className="space-y-3">
          {stats.spendByListing.map(({ listingId, listing, total, count }) => (
            <div key={listingId} className="flex items-center gap-6 rounded-2xl p-4 transition-colors hover:bg-surface-container-low">
              <ListingThumb listing={listing} title={listing?.title ?? `Listing #${listingId}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-on-surface">{listing?.title ?? `Listing #${listingId}`}</p>
                <p className="truncate text-xs text-on-surface-variant">
                  {listing?.location ?? "Location unavailable"} · {count} booking{count === 1 ? "" : "s"}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div
                    className="h-full rounded-full bg-secondary-container"
                    style={{ width: `${(total / maxListingSpend) * 100}%` }}
                  />
                </div>
              </div>
              <Money value={total} mode="full" className="shrink-0 font-headline text-sm font-black text-primary" />
            </div>
          ))}
        </div>
      </section>

      {/* ================= ADD-ON USAGE ================= */}
      {stats.addonTotals.size > 0 ? (
        <section className="rounded-3xl bg-surface-container-low p-8 md:p-10">
          <h3 className="mb-8 font-headline text-xl font-bold">Add-ons booked</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {Array.from(stats.addonTotals.entries()).map(([code, { count, amount }]) => (
              <div key={code} className="flex items-center gap-4 rounded-2xl bg-surface-container-lowest p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container/20 text-secondary">
                  <Icon name={ADDON_META[code]?.icon ?? "extension"} />
                </span>
                <div>
                  <p className="font-bold text-on-surface">{ADDON_META[code]?.label ?? code}</p>
                  <p className="text-xs text-on-surface-variant">
                    {count} order{count === 1 ? "" : "s"} ·{" "}
                    <Money value={amount} mode="full" />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ================= BOOKINGS TABLE ================= */}
      <section className="rounded-3xl bg-surface-container-lowest p-8 shadow-sm md:p-10">
        <h3 className="mb-8 font-headline text-xl font-bold">All bookings</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                <th className="pb-4 pr-4">Listing</th>
                <th className="pb-4 pr-4">Dates</th>
                <th className="pb-4 pr-4">Status</th>
                <th className="pb-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((b) => (
                <tr key={b.id} className="border-b border-border-subtle last:border-0">
                  <td className="py-4 pr-4 font-semibold text-on-surface">
                    {b.listing?.title ?? `Listing #${b.listing_id}`}
                  </td>
                  <td className="py-4 pr-4 text-on-surface-variant">
                    {formatIsoDate(b.start_date)} – {formatIsoDate(b.end_date)}
                  </td>
                  <td className="py-4 pr-4">
                    <Badge tone={PHASE_META[b.phase].tone}>{PHASE_META[b.phase].label}</Badge>
                  </td>
                  <td className="py-4 text-right font-bold text-on-surface">
                    <Money value={b.total_amount} mode="full" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ================= NOT INSTRUMENTED ================= */}
      <section className="rounded-3xl border border-dashed border-outline-variant bg-surface-container-low p-8 md:p-10">
        <div className="mb-6 flex items-center gap-3">
          <Icon name="info" className="text-on-surface-variant" />
          <h3 className="font-headline text-lg font-bold text-on-surface">Not instrumented in this POC</h3>
        </div>
        <p className="mb-8 max-w-2xl text-sm text-on-surface-variant">
          The prototype design shows impressions, reach, footfall, and click-through metrics — this build has no
          impression-tracking, footfall-sensor, or ad-verification backend, so those numbers can&apos;t be measured
          yet. Rather than invent figures, they&apos;re shown here as unavailable.
        </p>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {["Impressions", "Reach", "Footfall delivered", "Click-through rate"].map((label) => (
            <div key={label} className="rounded-2xl bg-surface-container-lowest p-6 text-center">
              <p className="mb-2 font-headline text-3xl font-black text-outline">—</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
              <Badge tone="tertiary" className="mt-3">
                Not tracked
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Client page: `RequireRole` bounces an anonymous visitor to
 * `/login?next=/analytics`, and a signed-in owner to `/marketplace` — this
 * dashboard reads `GET /bookings`, which is advertiser-only on the backend. */
export function AnalyticsClient() {
  return (
    <RequireRole role="advertiser" fallback="/marketplace">
      <main className="container mx-auto flex-grow px-6 py-12 lg:px-12">
        <AnalyticsBody />
      </main>
    </RequireRole>
  );
}

export default AnalyticsClient;
