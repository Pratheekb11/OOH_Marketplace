/**
 * Add-on labels/icons ONLY. Deliberately contains no prices — the backend's
 * `GET /addons` (MVP/backend/app/pricing.py's ADDON_CATALOG) is the single
 * source of truth for pricing. Never hardcode a rate here.
 *
 * Codes match the real catalog: printing | installation | monitoring (NOT
 * "maintenance" — an earlier wave guessed wrong against the old top-level
 * backend's VAS model).
 */
export type AddonCode = "printing" | "installation" | "monitoring";

export interface AddonMeta {
  code: AddonCode;
  label: string;
  icon: string;
}

export const ADDON_META: Record<AddonCode, AddonMeta> = {
  printing: {
    code: "printing",
    label: "Printing",
    icon: "print",
  },
  installation: {
    code: "installation",
    label: "Installation",
    icon: "engineering",
  },
  monitoring: {
    code: "monitoring",
    label: "Monitoring",
    icon: "verified_user",
  },
};

export const ADDON_CODES: AddonCode[] = ["printing", "installation", "monitoring"];
