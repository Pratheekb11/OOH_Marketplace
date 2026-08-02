import Link from "next/link";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export type ButtonVariant = "primary" | "gradient" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Standard CTA — bg-primary/hover:bg-secondary, uppercase tracking-widest,
  // matches nav "Sign In" and most form-submit buttons across the prototype.
  primary:
    "bg-primary text-white uppercase tracking-widest text-xs font-bold hover:bg-secondary",
  // .brand-gradient + scale interaction — used for Book Now / Proceed to
  // Payment, the prototype's highest-emphasis actions.
  gradient:
    "brand-gradient text-white uppercase tracking-widest text-xs font-bold hover:scale-[1.02] active:scale-95",
  outline:
    "border border-primary text-primary uppercase tracking-widest text-xs font-bold hover:bg-primary hover:text-white",
  ghost:
    "text-primary uppercase tracking-widest text-xs font-bold hover:bg-surface-container",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-4 py-2",
  md: "px-5 py-3",
  lg: "px-8 py-4",
};

type ButtonOwnProps<T extends ElementType> = {
  as?: T;
  href?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
};

export type ButtonProps<T extends ElementType = "button"> = ButtonOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof ButtonOwnProps<T>>;

/**
 * Polymorphic button. Pass `href` to render a Next.js <Link> (most common
 * case), or `as={SomeComponent}` for anything else. Defaults to a real
 * <button type="button"> so it never accidentally submits a wrapping form.
 */
export function Button<T extends ElementType = "button">({
  as,
  href,
  variant = "primary",
  size = "md",
  className = "",
  type,
  ...rest
}: ButtonProps<T>) {
  const Component = (href ? Link : (as ?? "button")) as ElementType;
  const isPlainButton = Component === "button";
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded-lg transition-smooth",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component
      className={classes}
      href={href}
      type={isPlainButton ? (type ?? "button") : type}
      {...rest}
    />
  );
}

export default Button;
