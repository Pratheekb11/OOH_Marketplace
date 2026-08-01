"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import Money from "@/components/ui/Money";
import Skeleton from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api";
import { formatIsoDate } from "@/lib/format";
import type { ListingOut } from "@/components/marketplace/types";
import type { Booking, BookingStatus } from "@/types/api";

/** `PaymentDetailOut` in MVP/backend/app/schemas.py. Declared locally since
 * only cart/checkout own this endpoint's shape. */
interface PaymentDetail {
  id: number;
  user_id: number;
  booking_ids: number[];
  amount: number;
  status: "created" | "paid" | "failed";
  provider_order_id: string;
  method_label: string;
  created_at: string;
  bookings: Booking[];
}

export interface ConfirmationPanelProps {
  paymentId: number;
}

function bookingStatusLabel(status: BookingStatus): string {
  if (status === "pending_payment") return "Pending payment";
  if (status === "booked") return "Booked";
  if (status === "active") return "Active";
  return "Cancelled";
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Renders from `GET /payments/{id}` — the URL (`/checkout?payment=<id>`) is
 * the only state a refresh needs, so reloading this page keeps working.
 * Enriches each booking with its listing's title/location via `GET
 * /listings/{id}` (BookingOut only carries `listing_id`); a listing fetch
 * failing degrades to "Listing #<id>" rather than blocking the receipt.
 */
export function ConfirmationPanel({ paymentId }: ConfirmationPanelProps) {
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [listings, setListings] = useState<Record<number, ListingOut>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    api<PaymentDetail>(`/payments/${paymentId}`)
      .then((data) => {
        if (cancelled) return;
        setPayment(data);
        const ids = Array.from(new Set(data.bookings.map((b) => b.listing_id)));
        void Promise.all(
          ids.map((id) =>
            api<ListingOut>(`/listings/${id}`)
              .then((listing) => [id, listing] as const)
              .catch(() => null),
          ),
        ).then((results) => {
          if (cancelled) return;
          const map: Record<number, ListingOut> = {};
          for (const result of results) {
            if (result) map[result[0]] = result[1];
          }
          setListings(map);
        });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (notFound || !payment) {
    return (
      <EmptyState
        icon="receipt_long"
        title="We couldn't find that payment"
        description="It may belong to a different account, or the link is incorrect."
        action={
          <Button variant="gradient" href="/cart">
            Back to cart
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col items-start gap-6 rounded-xl bg-surface-container-low p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-white">
            <Icon name="check_circle" fill={1} className="!text-3xl" />
          </span>
          <div>
            <h1 className="font-headline text-2xl font-black tracking-tight text-on-surface">Booking confirmed</h1>
            <p className="text-sm text-on-surface-variant">
              Order <span className="font-bold text-on-surface">{payment.provider_order_id}</span> · paid{" "}
              {formatTimestamp(payment.created_at)}
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Amount paid</p>
          <Money value={payment.amount} mode="full" className="font-headline text-2xl font-black text-primary" />
          <p className="text-xs text-on-surface-variant">{payment.method_label}</p>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="font-headline text-xl font-extrabold tracking-tight">
          {payment.bookings.length} booking{payment.bookings.length === 1 ? "" : "s"} created
        </h2>
        {payment.bookings.map((booking) => {
          const listing = listings[booking.listing_id];
          return (
            <div key={booking.id} className="rounded-xl bg-surface-container-low p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-headline text-lg font-bold text-on-surface">
                    {listing ? listing.title : `Listing #${booking.listing_id}`}
                  </p>
                  {listing ? (
                    <p className="flex items-center gap-1 text-sm text-on-surface-variant">
                      <Icon name="location_on" className="!text-sm" />
                      {listing.location}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-on-surface-variant">
                    {formatIsoDate(booking.start_date)} – {formatIsoDate(booking.end_date)} ·{" "}
                    {bookingStatusLabel(booking.status)}
                  </p>
                  {booking.addons && booking.addons.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {booking.addons.map((addon) => (
                        <span
                          key={addon.code}
                          className="inline-flex items-center gap-1 rounded-full bg-surface-container-highest px-3 py-1 text-[11px] font-bold text-on-surface-variant"
                        >
                          {addon.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Money value={booking.total_amount} mode="full" className="shrink-0 font-headline text-lg font-black text-primary" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Button variant="gradient" href="/marketplace" size="lg">
          Continue browsing
        </Button>
        <Button variant="outline" href="/" size="lg">
          Back home
        </Button>
      </div>
    </div>
  );
}

export default ConfirmationPanel;
