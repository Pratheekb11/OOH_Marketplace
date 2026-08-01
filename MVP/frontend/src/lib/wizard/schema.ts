import { z } from "zod";

/**
 * Per-step zod schemas. Each operates on the slice of WizardState relevant
 * to that step (all form values are strings/booleans as stored in state —
 * numeric fields are validated via z.coerce.number()). Gates the "Next"
 * button; `safeParse` results render inline per-field errors.
 */

export const detailsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(180, "Title must be under 180 characters"),
  spaceType: z.string().min(1, "Select a media type"),
  lighting: z.string().min(1, "Select a lighting type"),
  locationHint: z.string().trim().min(1, "Add a short location hint"),
  description: z.string().trim().min(10, "Describe the asset in at least 10 characters"),
  widthFt: z.coerce.number().gt(0, "Width must be greater than 0"),
  heightFt: z.coerce.number().gt(0, "Height must be greater than 0"),
});

export type DetailsFormValues = z.infer<typeof detailsSchema>;

export const locationSchema = z.object({
  address: z.string().trim().min(5, "Enter a full address"),
  latitude: z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= -90 && Number(v) <= 90), {
      message: "Latitude must be between -90 and 90",
    }),
  longitude: z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180), {
      message: "Longitude must be between -180 and 180",
    }),
  landmarks: z.string().trim().optional(),
  footfallRange: z.string().min(1, "Select an estimated daily foot fall"),
  areaClassification: z.string().min(1, "Select an area classification"),
});

export type LocationFormValues = z.infer<typeof locationSchema>;

export const pricingSchema = z.object({
  pricePerDay: z.coerce.number().gt(0, "Daily rate must be greater than 0"),
  weeklyRate: z.string().optional(),
  monthlyRate: z.string().optional(),
  quarterlyRate: z.string().optional(),
  annualRate: z.string().optional(),
  peakHourSurcharge: z.string().optional(),
  installationFee: z.string().optional(),
  maintenanceFee: z.string().optional(),
  pricingModel: z.enum(["fixed", "dynamic"]),
  bulkDiscount: z.string().optional(),
});

export type PricingFormValues = z.infer<typeof pricingSchema>;

export const availabilitySchema = z
  .object({
    operatingDays: z.object({ monFri: z.boolean(), sat: z.boolean(), sun: z.boolean() }),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    available247: z.boolean(),
    blackoutFrom: z.string().optional(),
    blackoutTo: z.string().optional(),
    blackoutReason: z.string().optional(),
    blackoutNotes: z.string().optional(),
    peakSeasons: z.object({ festival: z.boolean(), summer: z.boolean(), sports: z.boolean() }),
  })
  .refine((v) => !v.blackoutTo || !v.blackoutFrom || v.blackoutTo >= v.blackoutFrom, {
    message: "Blackout end date must be on or after the start date",
    path: ["blackoutTo"],
  });

export type AvailabilityFormValues = z.infer<typeof availabilitySchema>;

export const reviewSchema = z.object({
  agreedToTerms: z.literal(true, { message: "You must agree to the Terms of Service" }),
});

export type ReviewFormValues = z.infer<typeof reviewSchema>;

/** Flattens a zod safeParse error into `{ field: message }`, keyed by the
 * first path segment — good enough for these flat per-step schemas. */
export function flattenFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
