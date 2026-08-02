"use client";

import { useState } from "react";
import TextField from "@/components/ui/TextField";
import SelectField from "@/components/ui/SelectField";
import WizardStepShell from "@/components/wizard/WizardStepShell";
import WizardSection from "@/components/wizard/WizardSection";
import WizardNextLink from "@/components/wizard/WizardNextLink";
import { useWizard } from "@/lib/wizard/context";
import { locationSchema, flattenFieldErrors } from "@/lib/wizard/schema";
import { AREA_CLASSIFICATIONS, FOOTFALL_RANGES } from "@/lib/wizard/constants";

// Ported from Ui_Prototype_MVP_Prep/location.html.
export default function LocationStepPage() {
  const { state, dispatch } = useWizard();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const result = locationSchema.safeParse({
      address: state.address,
      latitude: state.latitude,
      longitude: state.longitude,
      landmarks: state.landmarks,
      footfallRange: state.footfallRange,
      areaClassification: state.areaClassification,
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
      titlePrefix="Pin Your"
      titleHighlight="Geographic Coordinates."
      description="Provide precise location details so brands can discover your media assets on the map and understand foot traffic patterns."
      footerIcon="location_on"
      footerCaption="Maps integrated verification"
      prevHref="/list-your-space/details"
      footerRight={<WizardNextLink href="/list-your-space/pricing" label="Next: Pricing" validate={validate} />}
    >
      <WizardSection heading="Geographic Position" description="Specify the exact location and nearby landmarks.">
        <TextField
          label="Full Address"
          placeholder="e.g., 123 MG Road, Bengaluru 560001"
          value={state.address}
          error={errors.address}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "address", value: e.target.value })}
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <TextField
            label="Latitude"
            placeholder="e.g., 12.9716"
            value={state.latitude}
            error={errors.latitude}
            hint="Optional"
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "latitude", value: e.target.value })}
          />
          <TextField
            label="Longitude"
            placeholder="e.g., 77.5946"
            value={state.longitude}
            error={errors.longitude}
            hint="Optional"
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "longitude", value: e.target.value })}
          />
        </div>

        <TextField
          label="Nearby Landmarks / Metro Station"
          placeholder="e.g., Trinity Metro Station, 500m away"
          value={state.landmarks}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "landmarks", value: e.target.value })}
        />

        <SelectField
          label="Estimated Daily Foot Fall"
          value={state.footfallRange}
          error={errors.footfallRange}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "footfallRange", value: e.target.value })}
        >
          <option value="">Select foot fall range</option>
          {FOOTFALL_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Area Classification"
          value={state.areaClassification}
          error={errors.areaClassification}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "areaClassification", value: e.target.value })}
        >
          <option value="">Select zone type</option>
          {AREA_CLASSIFICATIONS.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </SelectField>
      </WizardSection>
    </WizardStepShell>
  );
}
