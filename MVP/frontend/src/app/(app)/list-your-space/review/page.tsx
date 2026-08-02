"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import WizardStepShell from "@/components/wizard/WizardStepShell";
import WizardSection from "@/components/wizard/WizardSection";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { useWizard, clearWizardDraft } from "@/lib/wizard/context";
import {
  availabilitySchema,
  detailsSchema,
  locationSchema,
  pricingSchema,
  reviewSchema,
} from "@/lib/wizard/schema";
import { mapValidationErrorsToSteps, toListingPayload, type MappedValidationIssue } from "@/lib/wizard/to-payload";
import { AREA_CLASSIFICATIONS, FOOTFALL_RANGES } from "@/lib/wizard/constants";
import type { WizardState, WizardStepId } from "@/lib/wizard/types";
import type { Listing } from "@/types/api";

const STEP_LABELS: Record<WizardStepId, string> = {
  details: "Media Details",
  location: "Location",
  pricing: "Pricing",
  availability: "Availability",
  review: "Review",
};

const STEP_PATHS: Record<WizardStepId, string> = {
  details: "/list-your-space/details",
  location: "/list-your-space/location",
  pricing: "/list-your-space/pricing",
  availability: "/list-your-space/availability",
  review: "/list-your-space/review",
};

interface StepIssue {
  step: WizardStepId;
  message: string;
}

/** Re-runs every earlier step's zod schema against the live wizard state.
 * Guards against a user jumping straight to /review via a bookmarked link
 * or a sidebar click before finishing the earlier steps — the per-step
 * "Next" gates catch this in the normal flow, but nothing stops direct
 * navigation to this page. */
function validateAllSteps(state: WizardState): StepIssue[] {
  const issues: StepIssue[] = [];

  const details = detailsSchema.safeParse({
    title: state.title,
    spaceType: state.spaceType,
    lighting: state.lighting,
    locationHint: state.locationHint,
    description: state.description,
    widthFt: state.widthFt,
    heightFt: state.heightFt,
  });
  if (!details.success) issues.push({ step: "details", message: details.error.issues[0]?.message ?? "Incomplete" });

  const location = locationSchema.safeParse({
    address: state.address,
    latitude: state.latitude,
    longitude: state.longitude,
    landmarks: state.landmarks,
    footfallRange: state.footfallRange,
    areaClassification: state.areaClassification,
  });
  if (!location.success) issues.push({ step: "location", message: location.error.issues[0]?.message ?? "Incomplete" });

  const pricing = pricingSchema.safeParse({
    pricePerDay: state.pricePerDay,
    weeklyRate: state.weeklyRate,
    monthlyRate: state.monthlyRate,
    quarterlyRate: state.quarterlyRate,
    annualRate: state.annualRate,
    peakHourSurcharge: state.peakHourSurcharge,
    installationFee: state.installationFee,
    maintenanceFee: state.maintenanceFee,
    pricingModel: state.pricingModel,
    bulkDiscount: state.bulkDiscount,
  });
  if (!pricing.success) issues.push({ step: "pricing", message: pricing.error.issues[0]?.message ?? "Incomplete" });

  const availability = availabilitySchema.safeParse({
    operatingDays: state.operatingDays,
    startTime: state.startTime,
    endTime: state.endTime,
    available247: state.available247,
    blackoutFrom: state.blackoutFrom,
    blackoutTo: state.blackoutTo,
    blackoutReason: state.blackoutReason,
    blackoutNotes: state.blackoutNotes,
    peakSeasons: state.peakSeasons,
  });
  if (!availability.success)
    issues.push({ step: "availability", message: availability.error.issues[0]?.message ?? "Incomplete" });

  const review = reviewSchema.safeParse({ agreedToTerms: state.agreedToTerms });
  if (!review.success) issues.push({ step: "review", message: "You must agree to the Terms of Service" });

  return issues;
}

function inr(value: number | null): string {
  return value == null ? "Not set" : `₹${value.toLocaleString("en-IN")}`;
}

export default function ReviewStepPage() {
  const { state, dispatch } = useWizard();
  const router = useRouter();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [blockingIssues, setBlockingIssues] = useState<StepIssue[]>([]);
  const [serverIssues, setServerIssues] = useState<MappedValidationIssue[]>([]);

  const isEditMode = state.listingId != null;
  const footfallLabel =
    FOOTFALL_RANGES.find((range) => range.value === state.footfallRange)?.label ?? "Not set";

  async function handleSubmit() {
    const issues = validateAllSteps(state);
    setBlockingIssues(issues);
    setServerIssues([]);
    if (issues.length > 0) return;

    setSubmitting(true);
    const payload = toListingPayload(state);
    try {
      const listing = state.listingId
        ? await api<Listing>(`/listings/${state.listingId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await api<Listing>("/listings", { method: "POST", body: JSON.stringify(payload) });

      clearWizardDraft();
      showToast({
        title: isEditMode ? "Listing updated" : "Listing submitted",
        description: isEditMode ? undefined : "Your asset is now live on the marketplace.",
        tone: "success",
      });
      router.push(`/listings/${listing.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setServerIssues(mapValidationErrorsToSteps(err.detail));
      } else {
        showToast({
          title: "Couldn't submit listing",
          description: err instanceof ApiError ? err.message : "Please try again.",
          tone: "error",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const hasIssues = blockingIssues.length > 0 || serverIssues.length > 0;

  return (
    <WizardStepShell
      titlePrefix="Review Your"
      titleHighlight="Complete Listing."
      description="Final check before going live. Ensure all details are accurate and compelling for potential advertisers."
      footerIcon="verified_user"
      footerCaption="BBMP & BMRCL Verified"
      prevHref="/list-your-space/availability"
      footerRight={
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="brand-gradient flex-1 rounded-xl px-16 py-5 text-center font-syne font-bold text-white shadow-xl shadow-secondary/20 transition-transform hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-60 md:flex-none"
        >
          {submitting ? "Submitting…" : isEditMode ? "Save Changes" : "Submit Asset for Live"}
        </button>
      }
    >
      <WizardSection heading="Media Details" action={<EditLink step="details" />}>
        <SummaryRow label="Asset Name" value={state.title || "Not set"} />
        <SummaryRow label="Media Type" value={state.spaceType || "Not set"} />
        <SummaryRow label="Lighting" value={state.lighting || "Not set"} />
        <SummaryRow label="Dimensions" value={`${state.widthFt || "—"} × ${state.heightFt || "—"} feet`} last />
      </WizardSection>

      <WizardSection heading="Location" action={<EditLink step="location" />}>
        <SummaryRow label="Address" value={state.address || "Not set"} />
        <SummaryRow
          label="Coordinates"
          value={state.latitude && state.longitude ? `${state.latitude}°N, ${state.longitude}°E` : "Not set"}
        />
        <SummaryRow label="Daily Foot Fall" value={footfallLabel} />
        <SummaryRow
          label="Area"
          value={
            AREA_CLASSIFICATIONS.find((zone) => zone === state.areaClassification) ?? state.areaClassification ?? "Not set"
          }
          last
        />
      </WizardSection>

      <WizardSection heading="Pricing" action={<EditLink step="pricing" />}>
        <SummaryRow label="Daily Rate" value={inr(Number(state.pricePerDay) || null)} last />
        <div className="grid grid-cols-2 gap-4 pt-2 md:grid-cols-4">
          <RateTile label="Weekly" value={inr(Number(state.weeklyRate) || null)} />
          <RateTile label="Monthly" value={inr(Number(state.monthlyRate) || null)} />
          <RateTile label="Quarterly" value={inr(Number(state.quarterlyRate) || null)} />
          <RateTile label="Annual" value={inr(Number(state.annualRate) || null)} />
        </div>
      </WizardSection>

      <WizardSection heading="Availability" action={<EditLink step="availability" />}>
        <SummaryRow
          label="Operating Days"
          value={
            state.available247
              ? "24/7"
              : `${[
                  state.operatingDays.monFri ? "Mon-Fri" : null,
                  state.operatingDays.sat ? "Sat" : null,
                  state.operatingDays.sun ? "Sun" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "Not set"}, ${state.startTime}-${state.endTime}`
          }
        />
        <SummaryRow
          label="Next Blackout"
          value={state.blackoutFrom ? `${state.blackoutFrom} → ${state.blackoutTo || "—"}` : "None scheduled"}
        />
        <SummaryRow
          label="Peak Seasons"
          value={
            [
              state.peakSeasons.festival ? "Festival" : null,
              state.peakSeasons.summer ? "Summer" : null,
              state.peakSeasons.sports ? "Sports" : null,
            ]
              .filter(Boolean)
              .join(" & ") || "None selected"
          }
          last
        />
      </WizardSection>

      <WizardSection heading="Compliance" description="Verify all documents are uploaded.">
        <div className="flex items-center gap-3 rounded-lg border-l-4 border-slate-300 bg-white p-4">
          <Icon name="pending" className="text-2xl text-slate-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary">Proof of Ownership</p>
            <p className="text-[10px] text-slate-400">Document upload lands in a later milestone.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border-l-4 border-slate-300 bg-white p-4">
          <Icon name="pending" className="text-2xl text-slate-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary">GST Certificate</p>
            <p className="text-[10px] text-slate-400">Document upload lands in a later milestone.</p>
          </div>
        </div>
      </WizardSection>

      {hasIssues ? (
        <div className="rounded-xl border-l-4 border-error bg-error-container/40 p-6">
          <p className="mb-3 text-sm font-bold text-error">Fix these before submitting:</p>
          <ul className="space-y-2">
            {blockingIssues.map((issue) => (
              <li key={`blocking-${issue.step}`}>
                <Link href={STEP_PATHS[issue.step]} className="text-sm font-semibold text-primary underline">
                  Fix in {STEP_LABELS[issue.step]} →
                </Link>
                <span className="ml-2 text-xs text-on-surface-variant">{issue.message}</span>
              </li>
            ))}
            {serverIssues.map((issue, i) => (
              <li key={`server-${issue.field}-${i}`}>
                <Link href={STEP_PATHS[issue.step]} className="text-sm font-semibold text-primary underline">
                  Fix in {STEP_LABELS[issue.step]} →
                </Link>
                <span className="ml-2 text-xs text-on-surface-variant">{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border-l-4 border-secondary-container bg-tertiary-container/10 p-8">
        <div className="flex gap-4">
          <Icon name="gavel" className="shrink-0 text-2xl text-secondary-container" />
          <div>
            <p className="mb-4 text-sm leading-relaxed text-primary">
              <span className="font-bold">Verification Notice:</span> Your listing will undergo a 48-hour
              verification process by the AdSpace team. You&apos;ll receive updates via email and SMS.
            </p>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={state.agreedToTerms}
                onChange={(e) => dispatch({ type: "SET_FIELD", field: "agreedToTerms", value: e.target.checked })}
              />
              <span className="text-sm text-primary">
                I confirm all information provided is accurate and complete. I have read and agree to the{" "}
                <span className="font-semibold text-secondary">Terms of Service</span>.
              </span>
            </label>
          </div>
        </div>
      </div>
    </WizardStepShell>
  );
}

function SummaryRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${last ? "" : "border-b border-slate-200 pb-4"}`}>
      <span className="text-sm text-on-surface-variant">{label}</span>
      <span className="text-right font-semibold text-primary">{value}</span>
    </div>
  );
}

function RateTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4">
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className="text-lg font-bold text-secondary">{value}</p>
    </div>
  );
}

function EditLink({ step }: { step: WizardStepId }) {
  return (
    <Link href={STEP_PATHS[step]} className="inline-block pt-2 text-sm font-semibold text-secondary underline">
      Edit
    </Link>
  );
}
