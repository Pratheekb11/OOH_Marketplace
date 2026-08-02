import { inrCompact, inrFull } from "@/lib/format";

export interface MoneyProps {
  /** Amount in INR (rupees, not paise). */
  value: number;
  /** "compact" -> ₹45k (marketplace cards). "full" -> ₹1,45,000.00 (checkout/invoices). */
  mode?: "compact" | "full";
  className?: string;
}

export function Money({ value, mode = "compact", className }: MoneyProps) {
  const text = mode === "full" ? inrFull(value) : inrCompact(value);
  return <span className={className}>{text}</span>;
}

export default Money;
