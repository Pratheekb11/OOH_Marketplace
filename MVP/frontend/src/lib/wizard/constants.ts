/**
 * Option lists ported verbatim from the prototype's <select> markup
 * (Ui_Prototype_MVP_Prep/listing_your_adspace.html, location.html,
 * pricing.html, availability.html). Kept here so step pages and the
 * to-payload mapper share one source of truth instead of duplicating
 * option strings.
 */

export const SPACE_TYPES = [
  "Hoarding (Traditional)",
  "DOOH (Digital Out-of-Home)",
  "Bus Shelter",
  "Gantry",
  "Transit Media",
] as const;

// Matches listing_page.html's marketplace filter, so a listing created here
// is filterable there.
export const LIGHTING_TYPES = ["Non Lit", "Back Lit", "Front Lit", "LED"] as const;

export const AREA_CLASSIFICATIONS = [
  "Prime Business District",
  "Residential High Street",
  "Transit Hub",
  "Shopping Mall Vicinity",
  "Emerging Area",
] as const;

export interface FootfallRangeOption {
  value: string;
  label: string;
  /** Representative number stored in the backend's `footfall_estimate`
   * column — the prototype only offers a range, so this is the wizard's own
   * choice of "which number best represents this bucket" (midpoint, or the
   * floor for the open-ended top bucket). */
  estimate: number;
}

export const FOOTFALL_RANGES: FootfallRangeOption[] = [
  { value: "0-10000", label: "0 - 10,000", estimate: 5000 },
  { value: "10000-25000", label: "10,000 - 25,000", estimate: 17500 },
  { value: "25000-50000", label: "25,000 - 50,000", estimate: 37500 },
  { value: "50000-100000", label: "50,000 - 100,000", estimate: 75000 },
  { value: "100000+", label: "100,000+", estimate: 100000 },
];

export const BLACKOUT_REASONS = [
  "Maintenance / Repair",
  "Festival / Holiday",
  "Owner Usage",
  "Weather-Related Closure",
  "Other (specify below)",
] as const;

export const BULK_DISCOUNTS = [
  "No discount",
  "5% for 3+ months",
  "10% for 6+ months",
  "15% for 12+ months",
] as const;

export const WIZARD_STEPS = [
  { id: "details", path: "details", label: "Media Details", icon: "info" },
  { id: "location", path: "location", label: "Location", icon: "location_on" },
  { id: "pricing", path: "pricing", label: "Pricing", icon: "payments" },
  { id: "availability", path: "availability", label: "Availability", icon: "event_available" },
  { id: "review", path: "review", label: "Review", icon: "fact_check" },
] as const;
