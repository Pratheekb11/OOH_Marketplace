"use client";

export type AuthRole = "advertiser" | "owner";

const OPTIONS: { value: AuthRole; label: string }[] = [
  { value: "advertiser", label: "Advertiser" },
  { value: "owner", label: "Space Owner" },
];

/**
 * The "Advertiser | Space Owner" segmented control from login_Page.html
 * (lines ~95-102). The prototype ships it as static markup with no JS
 * (the second tab is unreachable); here it's real state shared by both
 * auth pages:
 *   - /login: cosmetic only — the login endpoint doesn't take a role, so
 *     this just lets a returning user confirm which side of the
 *     marketplace they're signing into. Purely local state, no
 *     hydration risk (no browser-only read).
 *   - /register: the real role selector feeding RegisterRequest.role.
 */
export function RoleToggle({ value, onChange }: { value: AuthRole; onChange: (role: AuthRole) => void }) {
  return (
    <div className="flex rounded-xl bg-surface-container-low p-1.5" role="tablist" aria-label="Account type">
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={
              active
                ? "flex-1 rounded-lg bg-surface-container-lowest px-4 py-3 text-sm font-bold text-on-surface shadow-sm transition-all"
                : "flex-1 rounded-lg px-4 py-3 text-sm font-medium text-on-surface-variant transition-all hover:text-on-surface"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default RoleToggle;
