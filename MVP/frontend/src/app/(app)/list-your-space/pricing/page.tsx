"use client";

import { useState } from "react";
import TextField from "@/components/ui/TextField";
import SelectField from "@/components/ui/SelectField";
import WizardStepShell from "@/components/wizard/WizardStepShell";
import WizardSection from "@/components/wizard/WizardSection";
import WizardNextLink from "@/components/wizard/WizardNextLink";
import { useWizard } from "@/lib/wizard/context";
import { pricingSchema, flattenFieldErrors } from "@/lib/wizard/schema";
import { BULK_DISCOUNTS } from "@/lib/wizard/constants";

/**
 * Ported from Ui_Prototype_MVP_Prep/pricing.html, with one deliberate
 * addition: "Daily Rate (INR)" as the first field, bound directly to
 * `price_per_day` (the only pricing field the backend actually persists —
 * see backend/app/main.py's VAS_RATES / booking base = inclusive days ×
 * price_per_day). The prototype's rate card is weekly/monthly/quarterly/
 * annual, which never tells the backend what a single day costs; deriving
 * it (monthly/30?) would be a silent pricing bug the owner never sees. The
 * four rate-card fields stay as display-only reference numbers, stored
 * under `extra.rate_card`.
 */
export default function PricingStepPage() {
  const { state, dispatch } = useWizard();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const result = pricingSchema.safeParse({
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
    if (result.success) {
      setErrors({});
      return true;
    }
    setErrors(flattenFieldErrors(result.error));
    return false;
  }

  return (
    <WizardStepShell
      titlePrefix="Define Your"
      titleHighlight="Economic Model."
      description="Set competitive rates for your media inventory. Our AI-powered pricing tool suggests optimal pricing based on location, traffic, and market demand."
      footerIcon="trending_up"
      footerCaption="AI-Powered Pricing Suggestions"
      prevHref="/list-your-space/location"
      footerRight={<WizardNextLink href="/list-your-space/availability" label="Next: Availability" validate={validate} />}
    >
      <WizardSection heading="Daily Rate" description="The rate advertisers are actually billed at booking time.">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Daily Rate (INR)</label>
          <div className="flex items-center gap-2 rounded-lg bg-white p-1">
            <span className="pl-3 font-bold text-primary">₹</span>
            <input
              type="number"
              min={0}
              placeholder="1500"
              className="w-full flex-1 rounded-lg border-none bg-transparent p-3 text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={state.pricePerDay}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "pricePerDay", value: e.target.value })}
            />
          </div>
          {errors.pricePerDay ? (
            <p className="text-xs text-error">{errors.pricePerDay}</p>
          ) : (
            <p className="text-[10px] text-slate-400">
              Booking totals are computed as inclusive days × this daily rate.
            </p>
          )}
        </div>
      </WizardSection>

      <WizardSection heading="Rate Card" description="Reference prices for different booking durations (display only).">
        <RateInput
          label="Weekly Rate (INR)"
          hint="Recommended price for 7-day bookings"
          placeholder="10000"
          value={state.weeklyRate}
          onChange={(v) => dispatch({ type: "SET_FIELD", field: "weeklyRate", value: v })}
        />
        <RateInput
          label="Monthly Rate (INR)"
          hint="Recommended price for 30-day bookings"
          placeholder="35000"
          value={state.monthlyRate}
          onChange={(v) => dispatch({ type: "SET_FIELD", field: "monthlyRate", value: v })}
        />
        <RateInput
          label="Quarterly Rate (INR)"
          hint="Recommended price for 90-day bookings"
          placeholder="95000"
          value={state.quarterlyRate}
          onChange={(v) => dispatch({ type: "SET_FIELD", field: "quarterlyRate", value: v })}
        />
        <RateInput
          label="Annual Rate (INR)"
          hint="Best rate for 365-day bookings"
          placeholder="350000"
          value={state.annualRate}
          onChange={(v) => dispatch({ type: "SET_FIELD", field: "annualRate", value: v })}
        />
      </WizardSection>

      <WizardSection heading="Modifiers" description="Optional charges for premium placement.">
        <RateInput
          label="Peak Hour Surcharge (₹ per day)"
          hint="Additional cost for exclusive 6pm-10pm slots"
          placeholder="5000"
          value={state.peakHourSurcharge}
          onChange={(v) => dispatch({ type: "SET_FIELD", field: "peakHourSurcharge", value: v })}
        />
        <RateInput
          label="Setup / Installation Fee (INR)"
          hint="One-time setup charge per campaign"
          placeholder="2000"
          value={state.installationFee}
          onChange={(v) => dispatch({ type: "SET_FIELD", field: "installationFee", value: v })}
        />
        <RateInput
          label="Maintenance / Monthly Support (INR)"
          hint="Monthly maintenance for upkeep of asset"
          placeholder="1000"
          value={state.maintenanceFee}
          onChange={(v) => dispatch({ type: "SET_FIELD", field: "maintenanceFee", value: v })}
        />
      </WizardSection>

      <WizardSection heading="Strategy" description="Choose your pricing approach.">
        <div className="space-y-4">
          <label className="block text-xs font-bold uppercase tracking-widest text-primary/60">Pricing Model</label>
          {(
            [
              { value: "fixed" as const, title: "Fixed Rates", blurb: "Same price regardless of season" },
              { value: "dynamic" as const, title: "Dynamic Pricing", blurb: "Adjust prices based on demand" },
            ]
          ).map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 bg-white p-3 ${
                state.pricingModel === option.value ? "border-primary" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="pricing_model"
                className="h-4 w-4"
                checked={state.pricingModel === option.value}
                onChange={() => dispatch({ type: "SET_FIELD", field: "pricingModel", value: option.value })}
              />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-primary">{option.title}</span>
                <span className="block text-[10px] text-slate-400">{option.blurb}</span>
              </span>
            </label>
          ))}
        </div>

        <SelectField
          label="Bulk Booking Discount (%)"
          hint="Discount offered for long-term bookings"
          value={state.bulkDiscount}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "bulkDiscount", value: e.target.value })}
        >
          {BULK_DISCOUNTS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>
      </WizardSection>
    </WizardStepShell>
  );
}

function RateInput({
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      label={label}
      type="number"
      min={0}
      placeholder={placeholder}
      hint={hint}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
