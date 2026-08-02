import { Suspense } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import MarketplaceBrowser from "./MarketplaceBrowser";
import MarketplaceSkeleton from "./MarketplaceSkeleton";

export const metadata = {
  title: "Marketplace | AdSpace Horizon",
};

/**
 * Ported from Ui_Prototype_MVP_Prep/listing_page.html. See
 * MarketplaceBrowser's doc comment for the layout-trap fix: the split pane
 * is closed off in its own flex section BEFORE this CTA + footer render, so
 * they're always reachable via normal page scroll (the prototype trapped
 * both inside an `overflow-hidden` main).
 */
export default function MarketplacePage() {
  return (
    <div className="flex flex-col font-epilogue">
      <Suspense fallback={<MarketplaceSkeleton />}>
        <MarketplaceBrowser />
      </Suspense>

      {/* ============== LIST YOUR SPACE CTA ============== */}
      <section className="max-w-full border-t border-surface-container bg-white px-8 py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 font-headline text-4xl font-bold text-primary md:text-5xl">
              Have Ad Space to Offer?
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-on-surface-variant">
              Join hundreds of media owners in Bengaluru who are already monetizing their assets
              on AdSpace Horizon. Get discovered by premium brands instantly.
            </p>

            <div className="mb-10 space-y-4">
              {[
                { title: "Instant Visibility", body: "Your inventory appears instantly to verified brands" },
                { title: "48-Hour Verification", body: "Quick compliance check & go live" },
                { title: "Revenue Analytics", body: "Track performance with real-time dashboards" },
              ].map((item) => (
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
              <button
                type="button"
                className="border-2 border-primary px-8 py-4 text-sm font-bold uppercase tracking-widest text-primary transition-all hover:bg-primary hover:text-white"
              >
                Learn More
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-[#d5e3ff] bg-gradient-to-br from-[#f0f3ff] to-[#e7eeff] p-12">
              <div className="space-y-6">
                <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
                  <Icon name="public" className="!text-4xl text-secondary" />
                  <div>
                    <p className="text-sm font-bold text-primary">Global Brand Access</p>
                    <p className="text-[11px] text-on-surface-variant">Connect with international advertisers</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl bg-white p-4 text-center shadow-sm">
                  <div>
                    <p className="text-2xl font-bold text-secondary">500+</p>
                    <p className="text-[10px] text-on-surface-variant">Brands</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-secondary">2K+</p>
                    <p className="text-[10px] text-on-surface-variant">Ads Listed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-secondary">₹50Cr+</p>
                    <p className="text-[10px] text-on-surface-variant">Booked</p>
                  </div>
                </div>

                <div className="rounded-xl border-l-4 border-secondary bg-primary/5 p-4">
                  <p className="mb-2 text-[11px] font-bold text-secondary">Average Performance</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-primary">Avg. Monthly Revenue</span>
                    <span className="font-bold text-primary">₹2.5L+</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
