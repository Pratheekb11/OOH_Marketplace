import type { Listing } from "@/types/api";
import { FOOTFALL_RANGES } from "./constants";
import { initialWizardState, type WizardState } from "./types";
import type { WizardStepId } from "./types";

/**
 * Body shape for `POST /listings` and `PUT /listings/{id}` (backend/app/
 * schemas.py ListingCreate / ListingUpdate — ListingUpdate is a bare alias
 * of ListingCreate, full-body replace). Not re-exported from
 * `src/types/api.ts` (out of this agent's scope to add to), so it's
 * declared locally here.
 */
export interface ListingCreatePayload {
  title: string;
  space_type: string;
  description: string;
  location: string;
  width_ft: number;
  height_ft: number;
  price_per_day: number;
  footfall_estimate: number | null;
  lighting: string | null;
  image_url: string | null;
  extra: Record<string, unknown> | null;
}

function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function selectedKeys(flags: Record<string, boolean>): string[] {
  return Object.entries(flags)
    .filter(([, checked]) => checked)
    .map(([key]) => key);
}

/** Maps the flattened wizard state into the `ListingCreate` request body.
 * Everything without a real Listing column (rate card, blackout dates,
 * operating hours, area classification, landmarks, peak seasons, bulk
 * discount, lat/long) is nested under `extra`. */
export function toListingPayload(state: WizardState): ListingCreatePayload {
  const footfallEstimate =
    FOOTFALL_RANGES.find((range) => range.value === state.footfallRange)?.estimate ?? null;
  const pricePerDay = numOrNull(state.pricePerDay);

  return {
    title: state.title.trim(),
    space_type: state.spaceType,
    description: state.description.trim(),
    location: state.address.trim(),
    width_ft: numOrNull(state.widthFt) ?? 0,
    height_ft: numOrNull(state.heightFt) ?? 0,
    price_per_day: pricePerDay ?? 0,
    footfall_estimate: footfallEstimate,
    lighting: state.lighting || null,
    image_url: null,
    extra: {
      location_hint: state.locationHint || null,
      landmarks: state.landmarks || null,
      latitude: numOrNull(state.latitude),
      longitude: numOrNull(state.longitude),
      footfall_range: state.footfallRange || null,
      area_classification: state.areaClassification || null,
      rate_card: {
        weekly: numOrNull(state.weeklyRate),
        monthly: numOrNull(state.monthlyRate),
        quarterly: numOrNull(state.quarterlyRate),
        annual: numOrNull(state.annualRate),
      },
      // Mirrors the seeded listings' extra.display_unit / extra.display_price.
      display_unit: "day",
      display_price: pricePerDay,
      peak_hour_surcharge: numOrNull(state.peakHourSurcharge),
      installation_fee: numOrNull(state.installationFee),
      maintenance_fee: numOrNull(state.maintenanceFee),
      pricing_model: state.pricingModel,
      bulk_discount: state.bulkDiscount || null,
      operating_hours: {
        days: { ...state.operatingDays },
        start_time: state.available247 ? null : state.startTime || null,
        end_time: state.available247 ? null : state.endTime || null,
        available_24_7: state.available247,
      },
      blackout:
        state.blackoutFrom || state.blackoutTo
          ? {
              from: state.blackoutFrom || null,
              to: state.blackoutTo || null,
              reason: state.blackoutReason || null,
              notes: state.blackoutNotes || null,
            }
          : null,
      peak_seasons: selectedKeys({ ...state.peakSeasons }),
    },
  };
}

/** Reverse of toListingPayload — hydrates wizard state from a fetched
 * `Listing` (edit mode). Reads back everything that toListingPayload wrote
 * into `extra`, falling back to sane defaults for anything missing (older
 * listings created before a field existed, or created outside the wizard). */
export function fromListing(listing: Listing): WizardState {
  const extra = (listing.extra ?? {}) as Record<string, unknown>;
  const rateCard = (extra.rate_card ?? {}) as Record<string, unknown>;
  const operatingHours = (extra.operating_hours ?? {}) as Record<string, unknown>;
  const operatingDaysRaw = (operatingHours.days ?? {}) as Record<string, unknown>;
  const blackout = (extra.blackout ?? {}) as Record<string, unknown>;
  const peakSeasonsList = Array.isArray(extra.peak_seasons) ? (extra.peak_seasons as unknown[]) : [];

  const asString = (value: unknown): string => (value == null ? "" : String(value));
  const asBool = (value: unknown, fallback: boolean): boolean =>
    typeof value === "boolean" ? value : fallback;

  return {
    ...initialWizardState,
    listingId: listing.id,

    title: listing.title ?? "",
    spaceType: listing.space_type ?? "",
    lighting: listing.lighting ?? "",
    locationHint: asString(extra.location_hint),
    description: listing.description ?? "",
    widthFt: asString(listing.width_ft),
    heightFt: asString(listing.height_ft),

    address: listing.location ?? "",
    latitude: asString(extra.latitude),
    longitude: asString(extra.longitude),
    landmarks: asString(extra.landmarks),
    footfallRange: asString(extra.footfall_range),
    areaClassification: asString(extra.area_classification),

    pricePerDay: asString(listing.price_per_day),
    weeklyRate: asString(rateCard.weekly),
    monthlyRate: asString(rateCard.monthly),
    quarterlyRate: asString(rateCard.quarterly),
    annualRate: asString(rateCard.annual),
    peakHourSurcharge: asString(extra.peak_hour_surcharge),
    installationFee: asString(extra.installation_fee),
    maintenanceFee: asString(extra.maintenance_fee),
    pricingModel: extra.pricing_model === "dynamic" ? "dynamic" : "fixed",
    bulkDiscount: asString(extra.bulk_discount),

    operatingDays: {
      monFri: asBool(operatingDaysRaw.monFri, true),
      sat: asBool(operatingDaysRaw.sat, true),
      sun: asBool(operatingDaysRaw.sun, false),
    },
    startTime: asString(operatingHours.start_time) || "06:00",
    endTime: asString(operatingHours.end_time) || "23:00",
    available247: asBool(operatingHours.available_24_7, false),
    blackoutFrom: asString(blackout.from),
    blackoutTo: asString(blackout.to),
    blackoutReason: asString(blackout.reason),
    blackoutNotes: asString(blackout.notes),
    peakSeasons: {
      festival: peakSeasonsList.includes("festival"),
      summer: peakSeasonsList.includes("summer"),
      sports: peakSeasonsList.includes("sports"),
    },

    agreedToTerms: false,
  };
}

/** FastAPI 422s are `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}`.
 * `loc` is something like ["body", "title"] — the field name is always the
 * last segment. Maps each issue's field back to the wizard step that owns
 * it, so the review page can render "Fix in Pricing →" instead of a raw
 * validation dump. */
const FIELD_TO_STEP: Record<string, WizardStepId> = {
  title: "details",
  space_type: "details",
  lighting: "details",
  description: "details",
  location: "location",
  footfall_estimate: "location",
  width_ft: "details",
  height_ft: "details",
  price_per_day: "pricing",
  image_url: "details",
  extra: "pricing",
};

export interface MappedValidationIssue {
  step: WizardStepId;
  field: string;
  message: string;
}

export function mapValidationErrorsToSteps(detail: unknown): MappedValidationIssue[] {
  if (!Array.isArray(detail)) return [];
  return detail.map((issue) => {
    const loc = Array.isArray((issue as { loc?: unknown[] })?.loc) ? (issue as { loc: unknown[] }).loc : [];
    const field = String(loc[loc.length - 1] ?? "");
    const message =
      typeof (issue as { msg?: unknown })?.msg === "string" ? (issue as { msg: string }).msg : "Invalid value";
    return { step: FIELD_TO_STEP[field] ?? "review", field, message };
  });
}
