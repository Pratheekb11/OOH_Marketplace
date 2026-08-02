"use client";

import { useState } from "react";
import TextField from "@/components/ui/TextField";
import SelectField from "@/components/ui/SelectField";
import WizardStepShell from "@/components/wizard/WizardStepShell";
import WizardSection from "@/components/wizard/WizardSection";
import WizardNextLink from "@/components/wizard/WizardNextLink";
import TextAreaField from "@/components/wizard/TextAreaField";
import { useWizard } from "@/lib/wizard/context";
import { availabilitySchema, flattenFieldErrors } from "@/lib/wizard/schema";
import { BLACKOUT_REASONS } from "@/lib/wizard/constants";
import type { OperatingDays, PeakSeasons } from "@/lib/wizard/types";

// Ported from Ui_Prototype_MVP_Prep/availability.html.
export default function AvailabilityStepPage() {
  const { state, dispatch } = useWizard();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const result = availabilitySchema.safeParse({
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
    if (result.success) {
      setErrors({});
      return true;
    }
    setErrors(flattenFieldErrors(result.error));
    return false;
  }

  function setOperatingDay(key: keyof OperatingDays, value: boolean) {
    dispatch({ type: "SET_OPERATING_DAY", key, value });
  }

  function setPeakSeason(key: keyof PeakSeasons, value: boolean) {
    dispatch({ type: "SET_PEAK_SEASON", key, value });
  }

  return (
    <WizardStepShell
      titlePrefix="Define Your"
      titleHighlight="Calendar & Hours."
      description="Set blackout dates, peak seasons, and operating hours for your media asset. Help brands understand when your inventory is available."
      footerIcon="event_available"
      footerCaption="Smart Calendar Sync"
      prevHref="/list-your-space/pricing"
      footerRight={<WizardNextLink href="/list-your-space/review" label="Next: Review" validate={validate} />}
    >
      <WizardSection heading="Operating Hours" description="Define when your media is active daily.">
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-widest text-primary/60">Operating Days</label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={state.operatingDays.monFri}
                onChange={(e) => setOperatingDay("monFri", e.target.checked)}
              />
              <span className="text-sm text-primary">Monday - Friday</span>
            </label>
            <label className="flex items-center gap-3 p-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={state.operatingDays.sat}
                onChange={(e) => setOperatingDay("sat", e.target.checked)}
              />
              <span className="text-sm text-primary">Saturday</span>
            </label>
            <label className="flex items-center gap-3 p-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={state.operatingDays.sun}
                onChange={(e) => setOperatingDay("sun", e.target.checked)}
              />
              <span className="text-sm text-primary">Sunday</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <TextField
            label="Start Time"
            type="time"
            disabled={state.available247}
            value={state.startTime}
            error={errors.startTime}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "startTime", value: e.target.value })}
          />
          <TextField
            label="End Time"
            type="time"
            disabled={state.available247}
            value={state.endTime}
            error={errors.endTime}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "endTime", value: e.target.value })}
          />
        </div>

        <label className="flex items-center justify-between rounded-lg border-2 border-slate-200 bg-white p-4">
          <span>
            <span className="block text-sm font-semibold text-primary">Available 24/7</span>
            <span className="block text-[10px] text-slate-400">Always available for bookings</span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 cursor-pointer"
            checked={state.available247}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "available247", value: e.target.checked })}
          />
        </label>
      </WizardSection>

      <WizardSection heading="Calendar & Exclusions" description="Mark dates when media is unavailable.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <TextField
            label="Blackout Period - From"
            type="date"
            hint="Start date of unavailability"
            value={state.blackoutFrom}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "blackoutFrom", value: e.target.value })}
          />
          <TextField
            label="Blackout Period - To"
            type="date"
            hint="End date of unavailability"
            error={errors.blackoutTo}
            value={state.blackoutTo}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "blackoutTo", value: e.target.value })}
          />
        </div>

        <SelectField
          label="Reason for Blackout"
          value={state.blackoutReason}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "blackoutReason", value: e.target.value })}
        >
          <option value="">Select a reason</option>
          {BLACKOUT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </SelectField>

        <TextAreaField
          label="Additional Notes"
          placeholder="Share any special instructions or exceptions…"
          rows={4}
          value={state.blackoutNotes}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "blackoutNotes", value: e.target.value })}
        />
      </WizardSection>

      <WizardSection heading="Peak Seasons" description="Define high-demand periods for premium rates.">
        <div className="space-y-3">
          <label className="flex items-center gap-3 rounded-lg border-2 border-slate-200 bg-white p-3 hover:border-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={state.peakSeasons.festival}
              onChange={(e) => setPeakSeason("festival", e.target.checked)}
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-primary">Festival Season</span>
              <span className="block text-[10px] text-slate-400">Oct-Dec (Festive Period, +20% premium)</span>
            </span>
          </label>
          <label className="flex items-center gap-3 rounded-lg border-2 border-slate-200 bg-white p-3 hover:border-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={state.peakSeasons.summer}
              onChange={(e) => setPeakSeason("summer", e.target.checked)}
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-primary">Summer Campaign Season</span>
              <span className="block text-[10px] text-slate-400">Mar-May (School Holidays, +15% premium)</span>
            </span>
          </label>
          <label className="flex items-center gap-3 rounded-lg border-2 border-slate-200 bg-white p-3 hover:border-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={state.peakSeasons.sports}
              onChange={(e) => setPeakSeason("sports", e.target.checked)}
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-primary">Sports Events Period</span>
              <span className="block text-[10px] text-slate-400">Cricket Season, +25% premium</span>
            </span>
          </label>
        </div>
      </WizardSection>
    </WizardStepShell>
  );
}
