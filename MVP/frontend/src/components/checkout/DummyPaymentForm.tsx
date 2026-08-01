"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import TextField from "@/components/ui/TextField";

export interface DummyPaymentFormProps {
  submitting: boolean;
  /** Surfaced by the parent after a failed `POST /checkout` (e.g. a 409 on
   * dates taken between add-to-cart and pay). Rendered above the submit
   * button; the parent owns recovery (sending the user back to /cart). */
  error?: string | null;
  onSubmit: (methodLabel: string) => void;
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * Simulated payment only — there is no real gateway wired up (see
 * MVP/backend/app/models.py's PaymentStatus + CLAUDE.md: confirmation is a
 * dev-only endpoint). Card fields are entirely cosmetic and are never sent
 * anywhere; only a derived `method_label` like "Card •••• 4242" (the last 4
 * typed digits) goes to `POST /checkout`.
 */
export function DummyPaymentForm({ submitting, error, onSubmit }: DummyPaymentFormProps) {
  const [name, setName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    const digits = cardNumber.replace(/\D/g, "");
    if (!name.trim()) {
      setValidationError("Enter the name on the card.");
      return;
    }
    if (digits.length < 4) {
      setValidationError("Enter a card number.");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      setValidationError("Enter the expiry as MM/YY.");
      return;
    }
    if (!/^\d{3,4}$/.test(cvv)) {
      setValidationError("Enter a valid CVV.");
      return;
    }

    const last4 = digits.slice(-4);
    onSubmit(`Card •••• ${last4}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="flex items-start gap-3 rounded-xl bg-surface-container-low p-4">
        <Icon name="lock" className="!text-lg text-secondary" />
        <p className="text-xs leading-relaxed text-on-surface-variant">
          This is a simulated payment for demo purposes — there is no real payment gateway behind it, and no card
          details ever leave your browser.
        </p>
      </div>

      <TextField
        label="Name on Card"
        name="cardholder"
        autoComplete="cc-name"
        placeholder="Jordan Rao"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <TextField
        label="Card Number"
        name="cardNumber"
        inputMode="numeric"
        autoComplete="cc-number"
        placeholder="4242 4242 4242 4242"
        value={cardNumber}
        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
      />

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Expiry (MM/YY)"
          name="expiry"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="09/28"
          value={expiry}
          onChange={(e) => setExpiry(formatExpiry(e.target.value))}
        />
        <TextField
          label="CVV"
          name="cvv"
          inputMode="numeric"
          autoComplete="cc-csc"
          placeholder="123"
          type="password"
          value={cvv}
          onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
      </div>

      {validationError ? <p className="text-sm font-bold text-error">{validationError}</p> : null}
      {error ? <p className="text-sm font-bold text-error">{error}</p> : null}

      <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Processing…" : "Pay Now"}
      </Button>
    </form>
  );
}

export default DummyPaymentForm;
