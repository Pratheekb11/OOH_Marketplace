"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import AddonPicker from "@/components/listing/AddonPicker";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Money from "@/components/ui/Money";
import { api, ApiError } from "@/lib/api";
import { formatIsoDate, inclusiveDays } from "@/lib/format";
import type { AddonOut } from "@/components/marketplace/types";
import type { CartItem } from "@/types/api";

export interface CartItemRowProps {
  item: CartItem;
  addons: AddonOut[];
  addonsLoading: boolean;
  addonsUnavailable: boolean;
  /** Checkout's read-only review uses the same row markup with the
   * edit/remove controls hidden. */
  readOnly?: boolean;
  /** Called after a successful PATCH/DELETE so the parent can refetch the
   * whole cart (totals are server-computed — never patched locally). */
  onChanged: () => void;
}

/**
 * One cart line, ported from checkout_page.html's "Booking Summary" card.
 * Degrades gracefully when `listing_image_url` is missing/404s (2 of the 9
 * seeded listings have a rotted image_url) — same onError-swap-to-placeholder
 * pattern as `ListingCard`.
 */
export function CartItemRow({ item, addons, addonsLoading, addonsUnavailable, readOnly = false, onChanged }: CartItemRowProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [startDate, setStartDate] = useState(item.start_date);
  const [endDate, setEndDate] = useState(item.end_date);
  const [selected, setSelected] = useState<string[]>(item.addons);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const showImage = Boolean(item.listing_image_url) && !imageFailed;
  const validRange = Boolean(startDate && endDate) && inclusiveDays(startDate, endDate) >= 1;

  function toggleAddon(code: string) {
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  function startEdit() {
    setStartDate(item.start_date);
    setEndDate(item.end_date);
    setSelected(item.addons);
    setRowError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setRowError(null);
  }

  async function saveEdit() {
    if (!validRange) {
      setRowError("End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    setRowError(null);
    try {
      await api(`/cart/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ start_date: startDate, end_date: endDate, addons: selected }),
      });
      setEditing(false);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setRowError(typeof err.detail === "string" ? err.detail : "Those dates were just taken.");
      } else {
        setRowError("Couldn't save those changes. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setRowError(null);
    try {
      await api(`/cart/items/${item.id}`, { method: "DELETE" });
      onChanged();
    } catch {
      setRowError("Couldn't remove this item. Please try again.");
      setRemoving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl bg-surface-container-low">
      <div className="flex flex-col md:flex-row">
        <div className="relative h-48 w-full shrink-0 md:h-auto md:w-64">
          {showImage ? (
            <Image
              src={item.listing_image_url as string}
              alt={item.listing_title}
              fill
              sizes="(min-width: 768px) 256px, 100vw"
              className="object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="brand-gradient flex h-full w-full flex-col items-center justify-center gap-2 text-white/90">
              <Icon name="image" className="!text-3xl" />
              <span className="max-w-[80%] truncate-line-2 text-center text-xs font-bold">{item.listing_title}</span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between p-8">
          <div>
            <div className="mb-2 flex items-start justify-between gap-4">
              <div>
                <Link
                  href={`/listings/${item.listing_id}`}
                  className="font-headline text-xl font-bold text-on-surface hover:text-secondary"
                >
                  {item.listing_title}
                </Link>
                <p className="mt-1 flex items-center gap-2 text-sm text-on-surface-variant">
                  <Icon name="location_on" className="!text-sm" />
                  {item.listing_location}
                </p>
              </div>
              <Money value={item.total_amount} mode="full" className="shrink-0 font-headline text-xl font-black text-primary" />
            </div>

            {editing ? (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Start</span>
                    <input
                      type="date"
                      value={startDate}
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
                {!validRange ? <p className="text-xs text-error">End date must be on or after the start date.</p> : null}

                <AddonPicker
                  addons={addons}
                  selected={selected}
                  onToggle={toggleAddon}
                  loading={addonsLoading}
                  unavailable={addonsUnavailable}
                />

                {rowError ? <p className="text-xs font-bold text-error">{rowError}</p> : null}

                <div className="flex gap-3">
                  <Button variant="gradient" size="sm" onClick={saveEdit} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-8">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant opacity-60">Duration</p>
                    <p className="font-bold text-on-surface">
                      {item.days} day{item.days === 1 ? "" : "s"} ({formatIsoDate(item.start_date)} – {formatIsoDate(item.end_date)})
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant opacity-60">Base rate</p>
                    <Money value={item.listing_price_per_day} mode="full" className="font-bold text-on-surface" />
                  </div>
                </div>

                {item.addon_lines.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.addon_lines.map((line) => (
                      <span
                        key={line.code}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-container-highest px-3 py-1 text-[11px] font-bold text-on-surface-variant"
                      >
                        {line.label}
                        <Money value={line.price} mode="full" className="text-secondary" />
                      </span>
                    ))}
                  </div>
                ) : null}

                {rowError ? <p className="mt-3 text-xs font-bold text-error">{rowError}</p> : null}
              </>
            )}
          </div>

          {!readOnly && !editing ? (
            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                onClick={startEdit}
                className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary hover:text-secondary"
              >
                <Icon name="edit" className="!text-sm" />
                Edit
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-error hover:opacity-70 disabled:opacity-50"
              >
                <Icon name="delete" className="!text-sm" />
                {removing ? "Removing…" : "Remove"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default CartItemRow;
