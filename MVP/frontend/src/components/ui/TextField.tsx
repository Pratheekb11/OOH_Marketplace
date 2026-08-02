import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

/**
 * The prototype's field idiom (login_Page.html / checkout_page.html):
 * uppercase tracking-widest label over a borderless, filled input.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
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
      <input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`w-full bg-surface-container-highest border-none rounded-lg p-4 text-on-surface placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-smooth ${
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

export default TextField;
