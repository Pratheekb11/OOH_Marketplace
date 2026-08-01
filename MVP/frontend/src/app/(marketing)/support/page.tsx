import type { ReactNode } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import SupportSearch from "./SupportSearch";

export const metadata = {
  title: "Support | AdSpace",
};

type FaqCategory = "booking" | "listing" | "billing";

interface FaqEntry {
  category: FaqCategory;
  question: string;
  answer: ReactNode;
}

const CATEGORIES: { id: FaqCategory; icon: string; title: string; blurb: string }[] = [
  {
    id: "booking",
    icon: "campaign",
    title: "Booking & Checkout",
    blurb: "How browsing, cart, add-ons, and the simulated payment step fit together.",
  },
  {
    id: "listing",
    icon: "storefront",
    title: "Listing Your Space",
    blurb: "The 5-step wizard for owners, and what happens after you submit.",
  },
  {
    id: "billing",
    icon: "payments",
    title: "Billing & Accounts",
    blurb: "Add-on pricing, demo credentials, and where the legal docs are (not yet).",
  },
];

const FAQS: FaqEntry[] = [
  {
    category: "booking",
    question: "How does booking a space actually work?",
    answer: (
      <>
        Open any listing from the{" "}
        <Link href="/marketplace" className="font-bold text-secondary hover:underline">
          marketplace
        </Link>
        , pick your start and end dates, optionally add printing, installation, or monitoring, and
        add it to your cart. From the cart you move to checkout, confirm the order, and get a
        booking confirmation with a receipt. You can hold multiple listings in your cart before
        checking out together.
      </>
    ),
  },
  {
    category: "booking",
    question: "Is payment real? Will my card actually be charged?",
    answer: (
      <>
        No. This is a proof-of-concept build — checkout runs a{" "}
        <span className="font-bold">simulated</span> payment step. No card data leaves your
        browser and no real payment gateway is wired up behind it. The confirmation and receipt
        you see are real records in the database, but no money moves.
      </>
    ),
  },
  {
    category: "billing",
    question: "What do the printing, installation, and monitoring add-ons cost?",
    answer: (
      <>
        Rates aren&apos;t listed here on purpose — they&apos;re pulled live from the same catalog
        the checkout math uses, so this page can never drift out of sync with what you&apos;re
        actually charged. Open any listing&apos;s booking panel, or your{" "}
        <Link href="/cart" className="font-bold text-secondary hover:underline">
          cart
        </Link>
        , to see current per-unit pricing before you pay.
      </>
    ),
  },
  {
    category: "listing",
    question: "How do I list my own ad space?",
    answer: (
      <>
        Use{" "}
        <Link href="/list-your-space" className="font-bold text-secondary hover:underline">
          List Your Space
        </Link>
        , a 5-step guided flow: space details, location, pricing, availability, and a final
        review before it goes live. Every new submission is auto-approved in this build — there&apos;s
        no manual review queue yet.
      </>
    ),
  },
  {
    category: "billing",
    question: "Are there demo accounts I can log in with?",
    answer: (
      <>
        Yes — this build seeds two accounts so you can try both sides of the marketplace without
        registering:
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-4">
            <Badge tone="secondary" className="mb-2">
              Owner
            </Badge>
            <p className="font-mono text-xs text-on-surface">owner@adspace.example</p>
            <p className="font-mono text-xs text-on-surface-variant">password123</p>
          </div>
          <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-4">
            <Badge tone="primary" className="mb-2">
              Advertiser
            </Badge>
            <p className="font-mono text-xs text-on-surface">advertiser@adspace.example</p>
            <p className="font-mono text-xs text-on-surface-variant">password123</p>
          </div>
        </div>
      </>
    ),
  },
  {
    category: "billing",
    question: "Where are your Terms of Service, Privacy Policy, and other legal docs?",
    answer: (
      <>
        Not written yet — this is a proof-of-concept build, not a live commercial product, so
        formal legal documents land in a later milestone. Any footer link labeled Terms, Privacy,
        or Compliance points back here rather than to a page that doesn&apos;t exist.
      </>
    ),
  },
];

function faqId(faq: FaqEntry): string {
  return `faq-${faq.question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

/**
 * Built from scratch, then re-aligned to Ui_Prototype_MVP_Prep/support_page.html's
 * visual language (large headline + pill search bar hero, rounded-full bento
 * category cards). One deliberate divergence: the prototype's "Support
 * Portal" ticket list is entirely fabricated (fake ticket IDs, agent names
 * "Marcus Chen"/"Sarah Jenkins", an invented "99.9% SLA" stat) with no
 * ticketing backend behind it — reproducing it here would be exactly the
 * kind of fake-numbers-presented-as-real thing this build avoids on the
 * Analytics page too. It's replaced with an honest FAQ (grouped into the
 * same three categories the bento cards advertise) and a real mailto
 * contact CTA. FAQ content describes only real, current behavior of this
 * build (simulated payment, live-priced add-ons, auto-approved listings,
 * demo accounts) — nothing here is aspirational copy.
 */
export default function SupportPage() {
  return (
    <div className="font-epilogue">
      {/* ================= HERO ================= */}
      <section className="border-b border-border-subtle bg-white px-8 py-24 md:px-16">
        <div className="mx-auto flex max-w-6xl flex-col items-end gap-12 md:flex-row">
          <div className="max-w-xl">
            <h1 className="mb-8 font-headline text-5xl font-extrabold leading-[0.95] tracking-tighter text-primary md:text-7xl">
              How can we <br /> help you scale?
            </h1>
            <p className="max-w-lg text-lg font-medium leading-relaxed text-on-surface-variant md:text-xl">
              One stop for your OOH needs — including when something needs explaining. Answers
              to what we hear most about booking, listing, and how this proof-of-concept
              marketplace actually behaves under the hood.
            </p>
          </div>

          <div className="w-full flex-grow">
            <SupportSearch entries={FAQS.map((faq) => ({ id: faqId(faq), question: faq.question }))} />
          </div>
        </div>
      </section>

      {/* ================= CATEGORY BENTO ================= */}
      <section className="bg-white px-8 py-16 md:px-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={`#${cat.id}`}
              className="group relative overflow-hidden rounded-3xl bg-surface-container-low p-10 transition-colors hover:bg-surface-container"
            >
              <Icon name={cat.icon} fill={1} className="!text-4xl text-secondary" />
              <h3 className="mb-3 mt-6 font-headline text-2xl font-bold text-on-surface">{cat.title}</h3>
              <p className="max-w-xs text-sm text-on-surface-variant">{cat.blurb}</p>
              <Icon
                name={cat.icon}
                className="pointer-events-none absolute -bottom-8 -right-8 !text-[9rem] text-primary/5 transition-opacity group-hover:text-primary/10"
              />
            </Link>
          ))}
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="scroll-mt-8 bg-surface px-8 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-16">
            <h2 className="mb-4 font-headline text-3xl font-bold text-primary">
              Frequently Asked Questions
            </h2>
            <div className="h-1 w-16 bg-primary" />
          </div>

          {CATEGORIES.map((cat) => (
            <div key={cat.id} id={cat.id} className="mb-16 scroll-mt-24 last:mb-0">
              <div className="mb-6 flex items-center gap-3">
                <Icon name={cat.icon} className="!text-xl text-secondary" />
                <h3 className="font-headline text-xl font-bold text-on-surface">{cat.title}</h3>
              </div>
              <div className="space-y-4">
                {FAQS.filter((faq) => faq.category === cat.id).map((faq) => (
                  <details
                    key={faq.question}
                    id={faqId(faq)}
                    className="group scroll-mt-24 rounded-xl border border-border-subtle bg-white p-6 open:shadow-sm"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-headline text-base font-bold text-on-surface marker:content-none">
                      {faq.question}
                      <Icon
                        name="expand_more"
                        className="!text-2xl shrink-0 text-secondary transition-transform duration-200 group-open:rotate-180"
                      />
                    </summary>
                    <div className="mt-4 text-sm leading-relaxed text-on-surface-variant">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section className="border-t border-border-subtle bg-white px-8 py-24">
        <div className="mx-auto max-w-4xl">
          <EmptyState
            icon="support_agent"
            title="Still stuck?"
            description="This is a demo build without a live support team, so there's no ticketing system behind this — but the inbox below is a genuine placeholder you can reach for anything not covered above."
            action={
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button href="mailto:support@adspace.example" variant="primary" size="lg">
                  <Icon name="mail" className="!text-lg" />
                  support@adspace.example
                </Button>
                <Button href="/marketplace" variant="outline" size="lg">
                  Browse the marketplace instead
                </Button>
              </div>
            }
          />
        </div>
      </section>
    </div>
  );
}
