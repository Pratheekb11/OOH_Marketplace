"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";
import TextField from "@/components/ui/TextField";
import { submitLead } from "@/lib/leads";

export interface CallbackButtonProps {
  /** Prefills the form's reason — usually the button's own label. */
  reason: string;
  /** Where the request came from; defaults to the current path. */
  source?: string;
  /** Set when the enquiry is about one space. */
  listingId?: number;
  className?: string;
  children: ReactNode;
}

type Phase = "editing" | "sending" | "sent";

/** Digits plus the separators people type; the API applies the same rule. */
function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "").length;
  return /^\+?[0-9\s\-()]+$/.test(value) && digits >= 10 && digits <= 15;
}

/**
 * A contact CTA ("Request Proposal", "Service Quotation", …) that opens a
 * three-field call-back form instead of dropping the visitor on /support.
 * The reason arrives prefilled from the button and stays editable. Leads land
 * in POST /leads, queued for the CRM.
 *
 * The dialog is portalled to <body>: several CTAs sit inside Reveal, whose
 * transform would otherwise trap a `fixed` overlay inside the section.
 */
export function CallbackButton({ reason, source, listingId, className = "", children }: CallbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [why, setWhy] = useState(reason);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; reason?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("editing");
  const firstField = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    firstField.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function openForm() {
    setWhy(reason);
    setErrors({});
    setFailure(null);
    setPhase("editing");
    setOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found: typeof errors = {};
    if (name.trim().length < 2) found.name = "Enter your name.";
    if (!isPhone(phone.trim())) found.phone = "Enter a valid phone number (10–15 digits).";
    if (why.trim().length < 2) found.reason = "Tell us what the call is about.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setPhase("sending");
    setFailure(null);
    try {
      await submitLead({
        name: name.trim(),
        phone: phone.trim(),
        reason: why.trim(),
        source: source ?? window.location.pathname,
        listing_id: listingId,
      });
      setPhase("sent");
    } catch {
      setPhase("editing");
      setFailure("We couldn't send your request. Please try again, or email support@adspace.example.");
    }
  }

  const dialog = (
    <div
      className="fade-in fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="pop-in relative w-full max-w-md border border-border-subtle bg-white p-8 text-left text-primary shadow-xl sm:p-10"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 p-1 text-on-surface-variant hover:text-primary"
        >
          <Icon name="close" />
        </button>
        <div className="mb-3 flex items-center gap-3">
          <span className="h-px w-8 bg-secondary" />
          <span className="font-inter text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">
            Request a call back
          </span>
        </div>
        <h2 id={titleId} className="mb-6 font-headline text-2xl font-bold normal-case tracking-normal">
          We&apos;ll call you back.
        </h2>

        {phase === "sent" ? (
          <div role="status" className="space-y-6">
            <p className="text-sm leading-relaxed text-on-surface-variant">
              Thanks, {name.trim()}. Our team will call you back on {phone.trim()} about &ldquo;{why.trim()}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full bg-primary py-4 font-inter text-xs font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-secondary"
            >
              Done
            </button>
          </div>
        ) : (
          <form noValidate onSubmit={onSubmit} className="space-y-5 normal-case tracking-normal">
            <TextField
              ref={firstField}
              label="Name"
              name="lead-name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={errors.name}
            />
            <TextField
              label="Phone"
              name="lead-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+91 98450 12345"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              error={errors.phone}
            />
            <TextField
              label="Reason"
              name="lead-reason"
              value={why}
              onChange={(event) => setWhy(event.target.value)}
              error={errors.reason}
              hint="Prefilled from the button you clicked — edit it if you like."
            />
            {failure ? (
              <p role="alert" className="text-xs text-error">
                {failure}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={phase === "sending"}
              className="w-full bg-primary py-4 font-inter text-xs font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-secondary disabled:opacity-50"
            >
              {phase === "sending" ? "Sending…" : "Request call back"}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={openForm} className={className}>
        {children}
      </button>
      {open ? createPortal(dialog, document.body) : null}
    </>
  );
}

export default CallbackButton;
