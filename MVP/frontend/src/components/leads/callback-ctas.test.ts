import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every "talk to us" CTA used to be a plain link to /support. Each one now
 * opens the call-back form with its own label as the prefilled reason.
 */
const SRC = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(SRC, path), "utf8");

const CTAS: [file: string, label: string][] = [
  ["app/(marketing)/page.tsx", "Request Proposal"],
  ["app/(marketing)/page.tsx", "Service Quotation"],
  ["app/(marketing)/page.tsx", "Schedule Demo Call"],
  ["app/(marketing)/page.tsx", "Speak to an Advisor"],
  ["app/(marketing)/partnerships/page.tsx", "Agency Rebates"],
  ["app/(auth)/layout.tsx", "Contact Sales"],
];

describe("call-back CTAs", () => {
  it.each(CTAS)("%s wires %s to the call-back form", (file, label) => {
    expect(read(file)).toMatch(new RegExp(`<CallbackButton[^>]*reason="${label}"`));
  });

  it("the landing page no longer sends any CTA to /support", () => {
    expect(read("app/(marketing)/page.tsx")).not.toContain('href="/support"');
  });

  it("the listing owner card asks about that specific space", () => {
    const source = read("components/listing/OwnerCard.tsx");
    expect(source).toContain("<CallbackButton");
    expect(source).toContain("listingId={listing.id}");
    expect(source).not.toContain('href="/support"');
  });
});
