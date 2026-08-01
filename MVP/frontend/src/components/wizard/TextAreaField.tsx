import { forwardRef, useId } from "react";
import type { TextareaHTMLAttributes } from "react";

export interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

/** Textarea sibling of `@/components/ui/TextField` — same borderless-filled
 * idiom, no equivalent exists in the shared ui kit yet so it lives here
 * (used by the wizard's description / additional-notes fields). */
export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, hint, containerClassName = "", className = "", ...rest },
  ref,
) {
  const generatedId = useId();
  const id = rest.name ?? generatedId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`flex flex-col gap-2 ${containerClassName}`}>
      <label htmlFor={id} className="text-xs font-bold font-label uppercase tracking-widest text-on-surface-variant">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`w-full resize-none rounded-lg border-none bg-surface-container-highest p-4 text-on-surface placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-smooth ${
          error ? "ring-2 ring-error/60" : ""
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-on-surface-variant/70">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default TextAreaField;
