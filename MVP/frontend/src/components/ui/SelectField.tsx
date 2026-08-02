import { forwardRef, useId } from "react";
import type { SelectHTMLAttributes, ReactNode } from "react";

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  children: ReactNode;
}

/** Same idiom as TextField, for the prototype's filter/wizard <select>s. */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, containerClassName = "", className = "", children, ...rest },
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
      <select
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`w-full bg-surface-container-highest border-none rounded-lg p-4 text-on-surface focus:ring-2 focus:ring-primary/20 focus:outline-none transition-smooth ${
          error ? "ring-2 ring-error/60" : ""
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
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

export default SelectField;
