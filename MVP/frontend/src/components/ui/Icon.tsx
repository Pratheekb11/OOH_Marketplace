/**
 * Centralizes the prototype's scattered
 * `style="font-variation-settings:'FILL' 1"` inline overrides into one prop.
 * Default weight 300 matches landing/checkout; pass weight={400} on
 * marketplace/login/wizard pages, matching the prototype's per-page CSS.
 */
export interface IconProps {
  name: string;
  fill?: 0 | 1;
  weight?: 300 | 400;
  className?: string;
}

export function Icon({ name, fill = 0, weight = 300, className }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined${className ? ` ${className}` : ""}`}
      style={{
        fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export default Icon;
