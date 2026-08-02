import Icon from "@/components/ui/Icon";
import Money from "@/components/ui/Money";
import Skeleton from "@/components/ui/Skeleton";
import type { AddonOut } from "@/components/marketplace/types";

export interface AddonPickerProps {
  addons: AddonOut[];
  selected: string[];
  onToggle: (code: string) => void;
  loading: boolean;
  unavailable: boolean;
}

/**
 * Ported from listing_view.html's "Value-Added Services" checkboxes.
 * `GET /addons` is the ONLY source of prices — nothing here is hardcoded.
 * `unavailable` covers the concurrent-build case where the route 404s.
 */
export function AddonPicker({ addons, selected, onToggle, loading, unavailable }: AddonPickerProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (unavailable || addons.length === 0) {
    return (
      <p className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
        Add-ons aren&apos;t available to book yet — check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {addons.map((addon) => {
        const checked = selected.includes(addon.code);
        return (
          <label
            key={addon.code}
            className={`flex cursor-pointer items-center justify-between rounded-xl border-l-4 p-6 transition-colors ${
              checked ? "border-secondary bg-surface-container" : "border-transparent bg-surface-container-low hover:border-secondary hover:bg-surface-container"
            }`}
          >
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(addon.code)}
                className="h-5 w-5 rounded border-outline text-secondary focus:ring-secondary"
              />
              <Icon name={addon.icon} className="!text-2xl text-secondary" />
              <div>
                <p className="font-bold">{addon.label}</p>
                <p className="text-sm text-on-surface-variant">{addon.blurb}</p>
              </div>
            </div>
            <Money value={addon.price} mode="full" className="font-black text-secondary" />
          </label>
        );
      })}
    </div>
  );
}

export default AddonPicker;
