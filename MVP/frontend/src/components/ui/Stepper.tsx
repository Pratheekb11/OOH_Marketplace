import { Fragment } from "react";

export interface Step {
  /** e.g. "Step 01" */
  label: string;
  /** e.g. "Summary" */
  title: string;
}

export interface StepperProps {
  steps: Step[];
  currentIndex: number;
  className?: string;
}

/** Horizontal "Step 01 / Summary" stepper, ported from checkout_page.html. */
export function Stepper({ steps, currentIndex, className = "" }: StepperProps) {
  return (
    <div className={`flex max-w-2xl items-center justify-between ${className}`}>
      {steps.map((step, i) => {
        const isActive = i === currentIndex;
        const isComplete = i < currentIndex;
        return (
          <Fragment key={step.label}>
            <div className="flex flex-col items-start gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                  isActive ? "text-secondary" : "text-on-surface-variant"
                }`}
              >
                {step.label}
              </span>
              <span
                className={`font-headline font-bold ${isActive ? "text-on-surface" : "text-on-surface-variant"}`}
              >
                {step.title}
              </span>
              <div
                className={`h-1 w-12 rounded-full ${
                  isActive || isComplete ? "bg-secondary" : "bg-surface-container-highest"
                }`}
              />
            </div>
            {i < steps.length - 1 ? (
              <div className="mx-8 mt-8 h-[1px] flex-1 bg-outline-variant opacity-30" />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

export default Stepper;
