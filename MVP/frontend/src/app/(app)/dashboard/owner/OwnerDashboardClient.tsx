"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import RequireRole from "@/components/auth/RequireRole";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import Money from "@/components/ui/Money";
import Skeleton from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { formatIsoDate } from "@/lib/format";
import type { Listing, OwnerBooking } from "@/types/api";

/**
 * The owner half of the marketplace, which had no surface at all before this:
 * `MyListingsPanel` (in the wizard sidebar) showed inventory, but nothing
 * anywhere showed an owner who had booked their spaces, for when, or for how
 * much.
 *
 * Every figure here comes from `GET /owner/bookings` + `GET /owner/listings`.
 * Nothing is modelled that the backend cannot answer: there is no payout or
 * settlement pipeline in this build, so the money shown is *booked value*,
 * split into the part that is the space's own rate and the part that is
 * platform-fulfilled add-ons — never presented as "paid out to you". The gap
 * is stated on the page rather than papered over, the same way `/analytics`
 * marks its uninstrumented metrics.
 */

type Phase = "upcoming" | "live" | "completed";

const PHASE_META: Record<Phase, { label: string; tone: "primary" | "secondary" | "tertiary" }> = {
  live: { label: "On air", tone: "secondary" },
  upcoming: { label: "Upcoming", tone: "primary" },
  completed: { label: "Completed", tone: "tertiary" },
};

/** Occupancy is quoted over a fixed forward window so the number means the
 * same thing on every visit, rather than drifting with how much history an
 * owner happens to have. */
const OCCUPANCY_WINDOW_DAYS = 90;

interface PhasedBooking extends OwnerBooking {
  phase: Phase;
}

function todayIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ISO date `days` after `iso`, computed on UTC components so it never
 * round-trips through a timezone-sensitive `new Date(string)` parse (see the
 * trap documented in lib/format.ts). */
function isoPlusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

function phaseOf(booking: OwnerBooking, today: string): Phase {
  if (booking.start_date > today) return "upcoming";
  if (booking.end_date < today) return "completed";
  return "live";
}

/** Inclusive overlap, in days, between a booking and the occupancy window.
 * String comparison is safe here: ISO dates sort lexicographically. */
function overlapDays(booking: OwnerBooking, windowStart: string, windowEnd: string): number {
  const start = booking.start_date > windowStart ? booking.start_date : windowStart;
  const end = booking.end_date < windowEnd ? booking.end_date : windowEnd;
  if (start > end) return 0;
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000) + 1;
}

/** Real CSV of the owner's own booking rows, built client-side from the same
 * fetched data — no export endpoint required. */
function exportCsv(bookings: PhasedBooking[]) {
  const header = [
    "booking_id",
    "listing_id",
    "listing",
    "location",
    "advertiser",
    "advertiser_email",
    "start_date",
    "end_date",
    "days",
    "base_amount",
    "addons_amount",
    "gst_amount",
    "total_amount",
    "status",
  ];
  const escape = (value: string) =>
    value.includes(",") || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
  const rows = bookings.map((b) => [
    String(b.id),
    String(b.listing_id),
    escape(b.listing_title),
    escape(b.listing_location),
    escape(b.advertiser_name),
    b.advertiser_email,
    b.start_date,
    b.end_date,
    String(b.days),
    b.base_amount.toFixed(2),
    b.addons_amount.toFixed(2),
    b.gst_amount.toFixed(2),
    b.total_amount.toFixed(2),
    b.status,
  ]);
  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "adspace-owner-bookings.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Same broken-image degrade as ListingCard/CartItemRow — 3 of the seeded
 * prototype images are dead upstream, so a thumbnail must not render a hole. */
function SpaceThumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-container-high">
      {showImage ? (
        <Image src={src as string} alt={alt} fill sizes="56px" className="object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="brand-gradient flex h-full w-full items-center justify-center text-white/90">
          <Icon name="image" className="!text-lg" />
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-96" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-3xl" />
      <Skeleton className="h-80 w-full rounded-3xl" />
    </div>
  );
}

function OwnerDashboardBody() {
  const [bookings, setBookings] = useState<OwnerBooking[] | null>(null);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<OwnerBooking[]>("/owner/bookings"), api<Listing[]>("/owner/listings")])
      .then(([bookingRows, listingRows]) => {
        if (cancelled) return;
        setBookings(bookingRows);
        setListings(listingRows);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your inventory and bookings. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = todayIsoLocal();

  const phased = useMemo<PhasedBooking[]>(() => {
    if (!bookings) return [];
    return bookings
      .filter((b) => b.status !== "cancelled")
      .map((b) => ({ ...b, phase: phaseOf(b, today) }));
  }, [bookings, today]);

  const stats = useMemo(() => {
    const grossBooked = phased.reduce((sum, b) => sum + b.total_amount, 0);
    const spaceRevenue = phased.reduce((sum, b) => sum + b.base_amount, 0);
    const addonRevenue = phased.reduce((sum, b) => sum + b.addons_amount, 0);
    const gstCollected = phased.reduce((sum, b) => sum + b.gst_amount, 0);

    const phaseCounts: Record<Phase, number> = { live: 0, upcoming: 0, completed: 0 };
    for (const b of phased) phaseCounts[b.phase] += 1;

    const windowStart = today;
    const windowEnd = isoPlusDays(today, OCCUPANCY_WINDOW_DAYS - 1);

    const active = (listings ?? []).filter((l) => String(l.status) === "active");
    const archived = (listings ?? []).filter((l) => String(l.status) === "archived");

    // Per-space rollup, keyed by listing so a space with zero bookings still
    // gets a row — "which of my spaces isn't selling" is the whole point.
    const bySpace = new Map<
      number,
      { title: string; location: string; image: string | null; status: string; bookings: number; revenue: number; bookedDays: number }
    >();
    for (const listing of listings ?? []) {
      bySpace.set(listing.id, {
        title: listing.title,
        location: listing.location,
        image: listing.image_url ?? null,
        status: String(listing.status),
        bookings: 0,
        revenue: 0,
        bookedDays: 0,
      });
    }
    for (const b of phased) {
      const entry = bySpace.get(b.listing_id) ?? {
        title: b.listing_title,
        location: b.listing_location,
        image: b.listing_image_url,
        status: b.listing_status,
        bookings: 0,
        revenue: 0,
        bookedDays: 0,
      };
      entry.bookings += 1;
      entry.revenue += b.base_amount;
      entry.bookedDays += overlapDays(b, windowStart, windowEnd);
      bySpace.set(b.listing_id, entry);
    }
    const spaces = Array.from(bySpace.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue || a.title.localeCompare(b.title));

    const sellableSpaces = spaces.filter((s) => s.status === "active").length;
    const bookedDayTotal = spaces.reduce((sum, s) => sum + s.bookedDays, 0);
    const occupancy =
      sellableSpaces > 0 ? bookedDayTotal / (sellableSpaces * OCCUPANCY_WINDOW_DAYS) : 0;

    const advertisers = new Set(phased.map((b) => b.advertiser_id));

    return {
      grossBooked,
      spaceRevenue,
      addonRevenue,
      gstCollected,
      phaseCounts,
      spaces,
      activeCount: active.length,
      archivedCount: archived.length,
      occupancy,
      bookedDayTotal,
      advertiserCount: advertisers.size,
      windowEnd,
    };
  }, [phased, listings, today]);

  if (error) {
    return (
      <EmptyState
        icon="error"
        title="Couldn't load your dashboard"
        description={error}
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (bookings === null || listings === null) {
    return <DashboardSkeleton />;
  }

  if (listings.length === 0) {
    return (
      <EmptyState
        icon="add_business"
        title="No spaces listed yet"
        description="List your first ad space and this dashboard will fill with real bookings, revenue and occupancy."
        action={
          <Button variant="gradient" href="/list-your-space">
            List a space
          </Button>
        }
      />
    );
  }

  const upcomingAndLive = phased
    .filter((b) => b.phase !== "completed")
    .sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
  const maxSpaceRevenue = Math.max(...stats.spaces.map((s) => s.revenue), 1);

  return (
    <div className="space-y-12">
      {/* ================= HEADER ================= */}
      <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 font-headline text-4xl font-extrabold tracking-tighter text-on-surface md:text-5xl">
            Your inventory
          </h1>
          <p className="max-w-2xl text-lg text-on-surface-variant">
            {stats.activeCount} live space{stats.activeCount === 1 ? "" : "s"}
            {stats.archivedCount > 0 ? ` · ${stats.archivedCount} archived` : ""} · {phased.length} booking
            {phased.length === 1 ? "" : "s"} from {stats.advertiserCount} advertiser
            {stats.advertiserCount === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Button variant="outline" onClick={() => exportCsv(phased)} className="rounded-full" disabled={phased.length === 0}>
            <Icon name="download" className="!text-lg" />
            Export bookings (CSV)
          </Button>
          <Button variant="primary" href="/list-your-space" className="rounded-full">
            <Icon name="add" className="!text-lg" />
            List a space
          </Button>
        </div>
      </section>

      {/* ================= KPIs ================= */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border-t-2 border-secondary-container bg-surface-container-lowest p-8 shadow-sm">
          <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-secondary">Space revenue</span>
          <Money value={stats.spaceRevenue} mode="full" className="font-headline text-4xl font-extrabold tracking-tighter text-on-surface" />
          <p className="mt-2 text-sm text-on-surface-variant">
            Your own rate × booked days, before GST and before any add-on services.
          </p>
        </div>

        <div className="rounded-3xl bg-surface-container-low p-8">
          <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Booking status
          </span>
          <div className="flex items-end gap-6">
            {(["live", "upcoming", "completed"] as Phase[]).map((phase) => (
              <div key={phase}>
                <div className="font-headline text-3xl font-extrabold text-on-surface">{stats.phaseCounts[phase]}</div>
                <Badge tone={PHASE_META[phase].tone} className="mt-1">
                  {PHASE_META[phase].label}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-surface-container-low p-8">
          <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Next {OCCUPANCY_WINDOW_DAYS} days occupancy
          </span>
          <div className="font-headline text-4xl font-extrabold tracking-tighter text-on-surface">
            {Math.round(stats.occupancy * 100)}%
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full rounded-full bg-secondary-container" style={{ width: `${Math.min(stats.occupancy * 100, 100)}%` }} />
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">
            {stats.bookedDayTotal} booked day{stats.bookedDayTotal === 1 ? "" : "s"} across your live spaces, through{" "}
            {formatIsoDate(stats.windowEnd)}.
          </p>
        </div>

        <div className="rounded-3xl bg-primary-container p-8 text-white">
          <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-on-primary-container">
            Gross booked value
          </span>
          <Money value={stats.grossBooked} mode="full" className="font-headline text-3xl font-extrabold" />
          <p className="mt-2 text-sm text-on-primary-container">
            Everything advertisers were charged: space, add-ons and the flat 18% GST.
          </p>
        </div>
      </section>

      {/* ================= WHAT THE ADVERTISER PAID FOR ================= */}
      <section className="rounded-3xl bg-surface-container-lowest p-8 shadow-sm md:p-10">
        <h3 className="mb-2 font-headline text-xl font-bold">What advertisers paid for</h3>
        <p className="mb-6 max-w-2xl text-sm text-on-surface-variant">
          Only the first band is your space&apos;s own rate. Add-ons are platform-fulfilled services and GST is
          statutory — neither is owner earnings.
        </p>
        <div className="flex h-4 w-full divide-x-2 divide-white overflow-hidden rounded-full bg-surface-container-highest">
          {[
            { key: "space", label: "Space rate", amount: stats.spaceRevenue, className: "bg-primary" },
            { key: "addons", label: "Add-on services", amount: stats.addonRevenue, className: "bg-secondary" },
            { key: "gst", label: "GST (18%)", amount: stats.gstCollected, className: "bg-tertiary-container" },
          ].map((seg) => (
            <div
              key={seg.key}
              title={`${seg.label}: ${seg.amount.toFixed(2)}`}
              className={seg.className}
              style={{ width: `${stats.grossBooked > 0 ? (seg.amount / stats.grossBooked) * 100 : 0}%` }}
            />
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-8">
          {[
            { key: "space", label: "Space rate", amount: stats.spaceRevenue, className: "bg-primary" },
            { key: "addons", label: "Add-on services", amount: stats.addonRevenue, className: "bg-secondary" },
            { key: "gst", label: "GST (18%)", amount: stats.gstCollected, className: "bg-tertiary-container" },
          ].map((seg) => (
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

      {/* ================= UPCOMING / LIVE ================= */}
      <section className="rounded-3xl bg-surface-container-low p-8 md:p-10">
        <h3 className="mb-8 font-headline text-xl font-bold">On air and upcoming</h3>
        {upcomingAndLive.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            Nothing is scheduled on your spaces right now. Past bookings are still listed below.
          </p>
        ) : (
          <div className="space-y-3">
            {upcomingAndLive.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-6 rounded-2xl bg-surface-container-lowest p-4">
                <SpaceThumb src={b.listing_image_url} alt={b.listing_title} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/listings/${b.listing_id}`} className="truncate font-bold text-on-surface hover:underline">
                      {b.listing_title}
                    </Link>
                    <Badge tone={PHASE_META[b.phase].tone}>{PHASE_META[b.phase].label}</Badge>
                  </div>
                  <p className="truncate text-xs text-on-surface-variant">
                    {formatIsoDate(b.start_date)} – {formatIsoDate(b.end_date)} · {b.days} day{b.days === 1 ? "" : "s"} ·{" "}
                    {b.listing_location}
                  </p>
                  <p className="mt-1 truncate text-xs text-on-surface-variant">
                    Booked by <span className="font-semibold text-on-surface">{b.advertiser_name}</span> ·{" "}
                    <a href={`mailto:${b.advertiser_email}`} className="font-semibold text-secondary hover:underline">
                      {b.advertiser_email}
                    </a>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Money value={b.base_amount} mode="full" className="font-headline text-sm font-black text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Space rate</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ================= PER-SPACE PERFORMANCE ================= */}
      <section className="rounded-3xl bg-surface-container-lowest p-8 shadow-sm md:p-10">
        <h3 className="mb-8 font-headline text-xl font-bold">Performance by space</h3>
        <div className="space-y-3">
          {stats.spaces.map((space) => (
            <div key={space.id} className="flex items-center gap-6 rounded-2xl p-4 transition-colors hover:bg-surface-container-low">
              <SpaceThumb src={space.image} alt={space.title} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="truncate font-bold text-on-surface">{space.title}</p>
                  {space.status === "archived" ? (
                    <Badge tone="tertiary" className="!bg-surface-container-highest !text-on-surface-variant">
                      Archived
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-xs text-on-surface-variant">
                  {space.location} · {space.bookings} booking{space.bookings === 1 ? "" : "s"} ·{" "}
                  {space.bookedDays} booked day{space.bookedDays === 1 ? "" : "s"} in the next {OCCUPANCY_WINDOW_DAYS}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div className="h-full rounded-full bg-secondary-container" style={{ width: `${(space.revenue / maxSpaceRevenue) * 100}%` }} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <Money value={space.revenue} mode="full" className="font-headline text-sm font-black text-primary" />
                <Link
                  href={`/list-your-space/details?listingId=${space.id}`}
                  className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-secondary hover:underline"
                >
                  Edit space
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= ALL BOOKINGS ================= */}
      <section className="rounded-3xl bg-surface-container-low p-8 md:p-10">
        <h3 className="mb-8 font-headline text-xl font-bold">All bookings on your spaces</h3>
        {phased.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            No one has booked your inventory yet. Bookings appear here the moment an advertiser checks out.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  <th className="pb-4 pr-4">Space</th>
                  <th className="pb-4 pr-4">Advertiser</th>
                  <th className="pb-4 pr-4">Dates</th>
                  <th className="pb-4 pr-4">Status</th>
                  <th className="pb-4 text-right">Space rate</th>
                  <th className="pb-4 text-right">Advertiser paid</th>
                </tr>
              </thead>
              <tbody>
                {phased.map((b) => (
                  <tr key={b.id} className="border-b border-border-subtle last:border-0">
                    <td className="py-4 pr-4 font-semibold text-on-surface">{b.listing_title}</td>
                    <td className="py-4 pr-4 text-on-surface-variant">
                      <span className="block font-semibold text-on-surface">{b.advertiser_name}</span>
                      <a href={`mailto:${b.advertiser_email}`} className="text-xs text-secondary hover:underline">
                        {b.advertiser_email}
                      </a>
                    </td>
                    <td className="py-4 pr-4 text-on-surface-variant">
                      {formatIsoDate(b.start_date)} – {formatIsoDate(b.end_date)}
                    </td>
                    <td className="py-4 pr-4">
                      <Badge tone={PHASE_META[b.phase].tone}>{PHASE_META[b.phase].label}</Badge>
                    </td>
                    <td className="py-4 text-right font-bold text-on-surface">
                      <Money value={b.base_amount} mode="full" />
                    </td>
                    <td className="py-4 text-right text-on-surface-variant">
                      <Money value={b.total_amount} mode="full" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================= NOT BUILT YET ================= */}
      <section className="rounded-3xl border border-dashed border-outline-variant bg-surface-container-low p-8 md:p-10">
        <div className="mb-6 flex items-center gap-3">
          <Icon name="info" className="text-on-surface-variant" />
          <h3 className="font-headline text-lg font-bold text-on-surface">Not built yet</h3>
        </div>
        <p className="mb-8 max-w-2xl text-sm text-on-surface-variant">
          Everything above is real data from your own inventory. These are the owner-side pieces this build genuinely
          does not have, shown as unavailable rather than mocked up.
        </p>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {["Payouts settled", "Next payout date", "Proof of display", "Occupancy vs market"].map((label) => (
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

/** `RequireRole` bounces an anonymous visitor to
 * `/login?next=/dashboard/owner`, and a signed-in advertiser to `/analytics`
 * (their equivalent surface) — both endpoints this page reads are owner-only
 * on the backend. */
export function OwnerDashboardClient() {
  return (
    <RequireRole role="owner" fallback="/analytics">
      <main className="container mx-auto flex-grow px-6 py-12 lg:px-12">
        <OwnerDashboardBody />
      </main>
    </RequireRole>
  );
}

export default OwnerDashboardClient;
