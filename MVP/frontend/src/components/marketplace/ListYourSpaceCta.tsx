import Link from "next/link";
import Icon from "@/components/ui/Icon";

export interface ListYourSpaceCtaProps {
  /** Live count of active listings, or null while it is unknown. */
  totalListings: number | null;
}

// Each line describes how the product works today, not an aspiration.
const POINTS = [
  { title: "Live when you submit", body: "Your space appears in the marketplace as soon as the listing is complete." },
  { title: "Your rates, your terms", body: "You set the day rate brands see and pay." },
  { title: "Bookings in one place", body: "See every booking on your spaces, and who made it, in your dashboard." },
];

/** The marketplace's owner call to action. Its only figure is the live listing count. */
export function ListYourSpaceCta({ totalListings }: ListYourSpaceCtaProps) {
  return (
    <section className="max-w-full border-t border-surface-container bg-white px-8 py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className="mb-6 font-headline text-4xl font-bold text-primary md:text-5xl">Have Ad Space to Offer?</h2>
          <p className="mb-8 text-lg leading-relaxed text-on-surface-variant">
            List your outdoor media on AdSpace and get in front of brands booking placements in Bengaluru.
          </p>

          <div className="mb-10 space-y-4">
            {POINTS.map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <Icon name="check_circle" fill={1} className="mt-1 shrink-0 !text-2xl text-secondary" />
                <div>
                  <h4 className="mb-1 font-bold text-primary">{item.title}</h4>
                  <p className="text-sm text-on-surface-variant">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/list-your-space"
              className="inline-block bg-primary px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-secondary"
            >
              List Your Space Now
            </Link>
            <Link
              href="/partnerships"
              className="inline-block border-2 border-primary px-8 py-4 text-sm font-bold uppercase tracking-widest text-primary transition-all hover:bg-primary hover:text-white"
            >
              Learn More
            </Link>
          </div>
        </div>

        {totalListings !== null ? (
          <div className="border border-border-subtle bg-surface p-12">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">Live inventory</p>
            <p className="font-headline text-6xl font-bold text-primary">{totalListings.toLocaleString("en-IN")}</p>
            <p className="mt-2 text-sm text-on-surface-variant">spaces listed in Bengaluru right now</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default ListYourSpaceCta;
