import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import type { ListingOut } from "@/components/marketplace/types";

export interface OwnerCardProps {
  listing: ListingOut;
}

/**
 * Who stands behind a space. There is no owner-profile endpoint yet, so this
 * says only what the listing itself supports: a verified badge when
 * `extra.verified` is set, and nothing about tenure, GST status or leasing
 * rights that no record backs.
 */
export function OwnerCard({ listing }: OwnerCardProps) {
  const verified = listing.extra?.verified === true;

  return (
    <section className="flex flex-col items-start gap-8 border border-border-subtle bg-white p-10 md:flex-row md:items-center">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-border-subtle bg-surface text-primary">
        <Icon name="storefront" className="!text-3xl" />
      </div>
      <div className="flex-grow">
        <h4 className="mb-2 font-headline text-xl font-bold text-primary">Listed on AdSpace</h4>
        {verified ? (
          <span className="mb-3 inline-flex items-center gap-1 border border-secondary/40 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-secondary">
            <Icon name="verified_user" className="!text-xs" />
            Verified owner
          </span>
        ) : null}
        <p className="text-sm leading-relaxed text-on-surface-variant">
          Owner contact details are shared once a booking is confirmed. Questions about this space before
          then go through our support team.
        </p>
      </div>
      <Button href="/support" variant="primary">
        Ask About This Space
      </Button>
    </section>
  );
}

export default OwnerCard;
