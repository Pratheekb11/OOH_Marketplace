import type { WIZARD_STEPS } from "./constants";

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

export interface OperatingDays {
  monFri: boolean;
  sat: boolean;
  sun: boolean;
}

export interface PeakSeasons {
  festival: boolean;
  summer: boolean;
  sports: boolean;
}

/**
 * The entire 5-step form, flattened into one object. All numeric-ish inputs
 * are kept as strings (controlled <input> friendly, empty string is a valid
 * "not filled in yet" state) — schema.ts coerces them to numbers for
 * validation, to-payload.ts casts them for the actual request body.
 *
 * `listingId` is null for a brand-new listing, or the id being edited when
 * the wizard was entered via `?listingId=<id>`.
 */
export interface WizardState {
  listingId: number | null;

  // Step 1 — Media Details
  title: string;
  spaceType: string;
  lighting: string;
  locationHint: string;
  description: string;
  widthFt: string;
  heightFt: string;

  // Step 2 — Location
  address: string;
  latitude: string;
  longitude: string;
  landmarks: string;
  footfallRange: string;
  areaClassification: string;

  // Step 3 — Pricing
  pricePerDay: string;
  weeklyRate: string;
  monthlyRate: string;
  quarterlyRate: string;
  annualRate: string;
  peakHourSurcharge: string;
  installationFee: string;
  maintenanceFee: string;
  pricingModel: "fixed" | "dynamic";
  bulkDiscount: string;

  // Step 4 — Availability
  operatingDays: OperatingDays;
  startTime: string;
  endTime: string;
  available247: boolean;
  blackoutFrom: string;
  blackoutTo: string;
  blackoutReason: string;
  blackoutNotes: string;
  peakSeasons: PeakSeasons;

  // Step 5 — Review
  agreedToTerms: boolean;
}

export const initialWizardState: WizardState = {
  listingId: null,

  title: "",
  spaceType: "",
  lighting: "",
  locationHint: "",
  description: "",
  widthFt: "",
  heightFt: "",

  address: "",
  latitude: "",
  longitude: "",
  landmarks: "",
  footfallRange: "",
  areaClassification: "",

  pricePerDay: "",
  weeklyRate: "",
  monthlyRate: "",
  quarterlyRate: "",
  annualRate: "",
  peakHourSurcharge: "",
  installationFee: "",
  maintenanceFee: "",
  pricingModel: "fixed",
  bulkDiscount: "",

  operatingDays: { monFri: true, sat: true, sun: false },
  startTime: "06:00",
  endTime: "23:00",
  available247: false,
  blackoutFrom: "",
  blackoutTo: "",
  blackoutReason: "",
  blackoutNotes: "",
  peakSeasons: { festival: false, summer: false, sports: false },

  agreedToTerms: false,
};

/** Discriminated union keyed off WizardState so `value`'s type always
 * matches `field`'s — e.g. `{ field: "widthFt", value: 12 }` is a compile
 * error, it must be a string. */
export type SetFieldAction = {
  [K in keyof WizardState]: { type: "SET_FIELD"; field: K; value: WizardState[K] };
}[keyof WizardState];

export type WizardAction =
  | SetFieldAction
  | { type: "SET_OPERATING_DAY"; key: keyof OperatingDays; value: boolean }
  | { type: "SET_PEAK_SEASON"; key: keyof PeakSeasons; value: boolean }
  | { type: "HYDRATE"; state: WizardState }
  | { type: "RESET" };
