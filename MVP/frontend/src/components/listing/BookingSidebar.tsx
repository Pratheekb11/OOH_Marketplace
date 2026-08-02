"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import Button from "@/components/ui/Button";
import Money from "@/components/ui/Money";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { formatIsoDate, inclusiveDays } from "@/lib/format";
import AddonPicker from "./AddonPicker";
import type { AddonOut, ListingOut } from "@/components/marketplace/types";

const GST_RATE = 0.18;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Local "today" in the browser's timezone, for the date inputs' default
 * value only — computed client-side inside an effect (never during render)
 * so the server-rendered "" doesn't mismatch the client's first paint. */
function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface BookingSidebarProps {
  listing: ListingOut;
}

/**
 * Client Component: start/end date inputs + AddonPicker, with a live quote
 * that mirrors MVP/backend/app/pricing.py's quote_line() exactly — inclusive
 * day count, round(..,2) at each step (base, GST, total) — labeled clearly
 * as an estimate since the server is authoritative at checkout.
 */
export function BookingSidebar({ listing }: BookingSidebarProps) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const [addons, setAddons] = useState<AddonOut[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const [addonsUnavailable, setAddonsUnavailable] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  // Client-only default dates (see todayIso's doc comment).
  useEffect(() => {
    const today = todayIso();
    setStartDate(today);
    setEndDate(today);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<AddonOut[]>("/addons")
      .then((data) => {
        if (!cancelled) setAddons(data);
      })
      .catch(() => {
        // Cart/addons routes are being built concurrently — a 404 here is
        // expected timing, not a real error. Degrade to "unavailable".
        if (!cancelled) setAddonsUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setAddonsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAddon = useCallback((code: string) => {
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }, []);

  const quote = useMemo(() => {
    if (!startDate || !endDate) return { days: 0, base: 0, addonsAmount: 0, gst: 0, total: 0, validRange: false };
    const days = inclusiveDays(startDate, endDate);
    const validRange = days >= 1;
    const base = validRange ? round2(days * listing.price_per_day) : 0;
    const addonsAmount = round2(
      selected.reduce((sum, code) => sum + (addons.find((a) => a.code === code)?.price ?? 0), 0),
    );
    const gst = validRange ? round2((base + addonsAmount) * GST_RATE) : 0;
    const total = validRange ? round2(base + addonsAmount + gst) : 0;
    return { days, base, addonsAmount, gst, total, validRange };
  }, [startDate, endDate, selected, addons, listing.price_per_day]);

  async function handleAddToCart() {
    setInlineError(null);
    setJustAdded(false);

    if (status === "loading") return;

    if (status !== "authenticated") {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!quote.validRange) {
      setInlineError("Pick a valid start and end date first.");
      return;
    }

    setSubmitting(true);
    try {
      await api("/cart/items", {
        method: "POST",
        body: JSON.stringify({
          listing_id: listing.id,
          start_date: startDate,
          end_date: endDate,
          addons: selected,
        }),
      });
      window.dispatchEvent(new Event("cart:changed"));
      setJustAdded(true);
      showToast({
        tone: "success",
        title: "Added to cart",
        description: (
          <>
            Head to your cart to review dates and check out.{" "}
            <Link href="/cart" className="font-bold text-secondary underline underline-offset-4">
              View cart
            </Link>
          </>
        ),
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setInlineError(typeof err.detail === "string" ? err.detail : "Those dates were just taken.");
      } else if (err instanceof ApiError && err.status === 404) {
        setInlineError("Cart isn't live yet — check back shortly.");
      } else {
        showToast({ tone: "error", title: "Couldn't add to cart", description: "Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const buttonLabel = status === "loading" ? "Loading…" : submitting ? "Adding…" : "Add to Cart";

  return (
    <aside className="w-full shrink-0 lg:w-[400px]">
      <div className="sticky top-28 space-y-6">
        <div className="glass-card space-y-6 rounded-2xl border border-outline-variant/10 p-8 shadow-xl shadow-primary/5">
          <div className="flex items-baseline justify-between">
            <div>
              <Money value={listing.price_per_day} mode="full" className="text-3xl font-black" />
              <p className="text-sm font-medium text-on-surface-variant">per day</p>
            </div>
            {listing.extra?.annual_discount ? (
              <div className="rounded-lg bg-secondary-fixed px-3 py-1 text-xs font-bold text-on-secondary-fixed">
                {listing.extra.annual_discount}
              </div>
            ) : null}
          </div>

          <div>
            <p className="mb-3 font-bold">Select Dates</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Start
                </span>
                <input
                  type="date"
                  value={startDate}
                  min={startDate || undefined}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg bg-surface-container-highest p-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">End</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg bg-surface-container-highest p-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>
            {startDate && endDate && !quote.validRange ? (
              <p className="mt-2 text-xs text-error">End date must be on or after the start date.</p>
            ) : startDate && endDate ? (
              <p className="mt-2 text-[11px] text-on-surface-variant">
                {quote.days} day{quote.days === 1 ? "" : "s"} selected — {formatIsoDate(startDate)} to{" "}
                {formatIsoDate(endDate)}
              </p>
            ) : null}
          </div>

          <div>
            <p className="mb-4 font-bold">Value-Added Services</p>
            <AddonPicker
              addons={addons}
              selected={selected}
              onToggle={toggleAddon}
              loading={addonsLoading}
              unavailable={addonsUnavailable}
            />
          </div>

          <div className="space-y-3 border-t border-surface-container-highest pt-6 text-sm">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">
                Base ({quote.days || 0} day{quote.days === 1 ? "" : "s"})
              </span>
              <Money value={quote.base} mode="full" className="font-bold" />
            </div>
            {quote.addonsAmount > 0 ? (
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Add-ons</span>
                <Money value={quote.addonsAmount} mode="full" className="font-bold" />
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-on-surface-variant">GST (18%)</span>
              <Money value={quote.gst} mode="full" className="font-bold" />
            </div>
            <div className="my-2 h-px w-full bg-surface-container-highest" />
            <div className="flex justify-between text-lg">
              <span className="font-black">Estimated Total</span>
              <Money value={quote.total} mode="full" className="font-black text-primary" />
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
            Estimate only — the server confirms the final total at checkout.
          </p>

          {inlineError ? <p className="text-xs font-bold text-error">{inlineError}</p> : null}

          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={submitting || status === "loading" || (Boolean(startDate && endDate) && !quote.validRange)}
            onClick={handleAddToCart}
          >
            {buttonLabel}
          </Button>

          {justAdded ? (
            <Link href="/cart" className="block text-center text-xs font-bold text-secondary underline underline-offset-4">
              View cart →
            </Link>
          ) : null}

          {listing.extra?.refund_policy ? (
            <p className="text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {listing.extra.refund_policy}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export default BookingSidebar;
