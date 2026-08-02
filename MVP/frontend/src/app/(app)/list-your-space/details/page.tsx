"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import TextField from "@/components/ui/TextField";
import SelectField from "@/components/ui/SelectField";
import WizardStepShell from "@/components/wizard/WizardStepShell";
import WizardSection from "@/components/wizard/WizardSection";
import WizardNextLink from "@/components/wizard/WizardNextLink";
import TextAreaField from "@/components/wizard/TextAreaField";
import { useWizard } from "@/lib/wizard/context";
import { detailsSchema, flattenFieldErrors } from "@/lib/wizard/schema";
import { LIGHTING_TYPES, SPACE_TYPES } from "@/lib/wizard/constants";

// Ported from Ui_Prototype_MVP_Prep/listing_your_adspace.html. Its
// "Scale & Valuation" section split dimensions from a weekly/monthly rate
// card — the rate card now lives entirely on the Pricing step, so this page
// only keeps the physical dimensions.
export default function DetailsStepPage() {
  const { state, dispatch } = useWizard();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const result = detailsSchema.safeParse({
      title: state.title,
      spaceType: state.spaceType,
      lighting: state.lighting,
      locationHint: state.locationHint,
      description: state.description,
      widthFt: state.widthFt,
      heightFt: state.heightFt,
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
      titlePrefix="Expand Your"
      titleHighlight="Urban Footprint."
      description="Showcase your Bengaluru media assets to a premium network of brands. Our Architectural Curator system ensures your inventory is presented with precision and authority."
      footerIcon="security"
      footerCaption="End-to-End Encrypted Uploads"
      footerRight={<WizardNextLink href="/list-your-space/location" label="Next: Location" validate={validate} />}
    >
      <WizardSection heading="Media Core" description="Define the identity and physical category of your asset.">
        <TextField
          label="Name of Media Asset"
          placeholder="e.g., MG Road Digital Landmark"
          value={state.title}
          error={errors.title}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "title", value: e.target.value })}
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SelectField
            label="Media Type"
            value={state.spaceType}
            error={errors.spaceType}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "spaceType", value: e.target.value })}
          >
            <option value="">Select media type</option>
            {SPACE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Lighting Type"
            value={state.lighting}
            error={errors.lighting}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "lighting", value: e.target.value })}
          >
            <option value="">Select lighting type</option>
            {LIGHTING_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label="Specific Location in Bengaluru"
          placeholder="e.g., Near Trinity Metro Station"
          hint="A short landmark-style hint shown alongside the full address you'll add on the next step."
          value={state.locationHint}
          error={errors.locationHint}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "locationHint", value: e.target.value })}
        />
        <TextAreaField
          label="Description"
          placeholder="Describe visibility, traffic, and what makes this asset stand out to advertisers…"
          rows={4}
          value={state.description}
          error={errors.description}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })}
        />
      </WizardSection>

      <WizardSection heading="Scale" description="Specify the physical dimensions of your media asset.">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <TextField
              label="Width (ft)"
              type="number"
              min={0}
              placeholder="20"
              value={state.widthFt}
              error={errors.widthFt}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "widthFt", value: e.target.value })}
            />
          </div>
          <span className="mt-6 text-slate-300">×</span>
          <div className="flex-1">
            <TextField
              label="Height (ft)"
              type="number"
              min={0}
              placeholder="40"
              value={state.heightFt}
              error={errors.heightFt}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "heightFt", value: e.target.value })}
            />
          </div>
        </div>
      </WizardSection>

      <WizardSection heading="Verification Vault" description="Regulatory compliance and ownership authentication.">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/50 p-8 text-center opacity-60">
            <Icon name="description" className="mb-4 !text-4xl text-slate-300" />
            <p className="mb-1 text-sm font-bold text-primary">Proof of Ownership</p>
            <p className="text-[10px] text-slate-400">Document upload lands in a later milestone.</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/50 p-8 text-center opacity-60">
            <Icon name="verified" className="mb-4 !text-4xl text-slate-300" />
            <p className="mb-1 text-sm font-bold text-primary">Registered GST Certificate</p>
            <p className="text-[10px] text-slate-400">Document upload lands in a later milestone.</p>
          </div>
        </div>
        <div className="flex gap-4 rounded-lg border-l-4 border-secondary-container bg-tertiary-container/5 p-6">
          <Icon name="gavel" className="text-secondary-container" />
          <p className="text-sm leading-relaxed text-primary">
            <span className="font-bold">Disclaimer:</span> All listings are subject to a mandatory 48-hour
            verification process by the AdSpace team to ensure compliance with{" "}
            <span className="font-bold text-secondary">BBMP/BMRCL regulations</span>. Accurate documentation
            accelerates this process.
          </p>
        </div>
      </WizardSection>
    </WizardStepShell>
  );
}
