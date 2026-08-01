import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

// Ported from Ui_Prototype_MVP_Prep/index.html (551 lines) + css/landing_page.css.
// Pure Server Component — no client JS. The prototype's search modal
// (openSearchModal/closeSearchModal/performSearch, lines ~473-551) is
// deliberately dropped: it's a client-only DOM-search toy with no backend
// counterpart, out of scope for this port.
//
// Two structural bugs in the source HTML are fixed here rather than
// reproduced (browsers auto-correct malformed HTML, JSX will not compile):
//   - the Value Pillars <section> (~line 118) was never closed before the
//     Marketplace Selects <section> opened — each section below is properly
//     self-contained.
//   - a stray </main> (~line 423) had no opening tag anywhere in the file —
//     omitted; there is no wrapping <main> in the source to begin with.
export default function LandingPage() {
  return (
    <>
      {/* ================= HERO ================= */}
      <section className="relative flex min-h-[85vh] items-center overflow-hidden border-b border-border-subtle">
        <div className="mx-auto w-full max-w-7xl px-8 py-20">
          <div className="grid grid-cols-1 items-stretch gap-0 lg:grid-cols-12">
            {/* Left: headline + CTAs */}
            <div className="flex flex-col justify-center pr-12 lg:col-span-7">
              <div className="mb-8 flex items-center gap-4">
                <span className="h-px w-12 bg-secondary" />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Bengaluru OOH Direct
                </span>
              </div>

              <h1 className="mb-8 font-headline text-5xl font-bold leading-[1.1] text-primary md:text-7xl">
                Curated Physical <br />
                <span className="font-normal italic">Media Placements.</span>
              </h1>

              <p className="mb-12 max-w-lg font-light text-lg leading-relaxed text-on-surface-variant">
                A marketplace connecting premium brands with verified high-impact outdoor
                assets. Skip the worries and secure your adspot now.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/marketplace"
                  className="bg-primary px-10 py-4 text-xs font-bold uppercase tracking-[0.15em] text-white transition-all hover:bg-secondary"
                >
                  View Inventory
                </Link>
                <button
                  type="button"
                  className="border border-primary px-10 py-4 text-xs font-bold uppercase tracking-[0.15em] text-primary transition-all hover:bg-primary hover:text-white"
                >
                  Request Proposal
                </button>
              </div>
            </div>

            {/* Right: hero image + stats card */}
            <div className="relative mt-16 lg:col-span-5 lg:mt-0">
              <div className="relative z-10 h-full w-full border border-primary/10">
                <div className="relative aspect-[4/5] w-full lg:h-full">
                  <Image
                    src="/images/hero/landing-hero.png"
                    alt="Premium billboard placement"
                    fill
                    priority
                    sizes="(min-width: 1024px) 40vw, 90vw"
                    className="object-cover grayscale-[20%] transition-all duration-700 hover:grayscale-0"
                  />
                </div>
              </div>

              <div className="absolute -bottom-6 -right-6 z-20 min-w-[240px] border border-border-subtle bg-white p-8 shadow-sm">
                <div className="mb-1 font-headline text-4xl font-bold text-primary">250K+</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Daily Reach / MG Road
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="architectural-grid pointer-events-none absolute inset-0 -z-10 opacity-30" />
      </section>

      {/* ================= VALUE PILLARS ================= */}
      <section className="bg-white px-8 py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
            <div className="space-y-6">
              <div className="text-secondary">
                <Icon name="account_balance" className="!text-4xl" />
              </div>
              <h3 className="font-headline text-xl font-bold tracking-tight">Financial Transparency</h3>
              <p className="font-light text-sm leading-relaxed text-on-surface-variant">
                Direct-to-owner pricing structures that eliminate any overhead. Real-time rate
                cards and transparent settlements with agreements.
              </p>
            </div>

            <div className="space-y-6">
              <div className="text-secondary">
                <Icon name="architecture" className="!text-4xl" />
              </div>
              <h3 className="font-headline text-xl font-bold tracking-tight">Verified Inventory</h3>
              <p className="font-light text-sm leading-relaxed text-on-surface-variant">
                Every location is physically audited for structural integrity, visibility
                angles, and lighting performance metrics.
              </p>
            </div>

            <div className="space-y-6">
              <div className="text-secondary">
                <Icon name="precision_manufacturing" className="!text-4xl" />
              </div>
              <h3 className="font-headline text-xl font-bold tracking-tight">Managed Fulfillment</h3>
              <p className="font-light text-sm leading-relaxed text-on-surface-variant">
                End-to-end logistics including large-format technical printing, certified
                rigging, and bi-weekly photo audits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MARKETPLACE SELECTS ================= */}
      <section className="bg-surface px-8 py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 flex flex-col items-end justify-between gap-4 md:flex-row">
            <div>
              <h2 className="mb-4 font-headline text-4xl font-bold">Marketplace Selects</h2>
              <div className="h-1 w-20 bg-primary" />
            </div>
            <Link
              href="/marketplace"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors hover:text-secondary"
            >
              All Placements
              <Icon name="north_east" className="!text-sm" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            {/* Feature card */}
            <Link
              href="/marketplace"
              className="group block cursor-pointer overflow-hidden border border-border-subtle bg-white md:col-span-7"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image
                  src="/images/misc/index-feature-digital.png"
                  alt="MG Road digital billboard cluster"
                  fill
                  sizes="(min-width: 768px) 58vw, 100vw"
                  className="object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
                />
              </div>
              <div className="p-8">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="mb-1 font-headline text-2xl font-bold">MG Road Digital Cluster</h3>
                    <p className="font-light text-sm text-on-surface-variant">
                      Financial District &bull; Digital Network
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">₹85,000</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Per Week
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* Side cards */}
            <div className="flex flex-col gap-8 md:col-span-5">
              <Link
                href="/marketplace"
                className="group flex h-full cursor-pointer flex-col overflow-hidden border border-border-subtle bg-white"
              >
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src="/images/misc/index-tile-mall.png"
                    alt="Retail kiosk placements at Mall of Asia"
                    fill
                    sizes="(min-width: 768px) 42vw, 100vw"
                    className="object-cover grayscale transition-all duration-700 group-hover:grayscale-0"
                  />
                </div>
                <div className="p-6">
                  <h3 className="mb-1 font-headline text-lg font-bold">Retail Kiosks: Mall of Asia</h3>
                  <p className="font-light text-xs text-on-surface-variant">Lifestyle &bull; 12 Units</p>
                </div>
              </Link>

              <Link
                href="/marketplace"
                className="group flex h-full cursor-pointer flex-col overflow-hidden border border-border-subtle bg-white"
              >
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src="/images/misc/index-tile-metro.png"
                    alt="Metro station transit panel network"
                    fill
                    sizes="(min-width: 768px) 42vw, 100vw"
                    className="object-cover grayscale transition-all duration-700 group-hover:grayscale-0"
                  />
                </div>
                <div className="p-6">
                  <h3 className="mb-1 font-headline text-lg font-bold">Transit Network: Metro Panels</h3>
                  <p className="font-light text-xs text-on-surface-variant">Commuter &bull; 50 Stations</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= INSTITUTIONAL SUPPORT ================= */}
      <section className="relative overflow-hidden bg-primary px-8 py-32 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-24 lg:grid-cols-2">
            <div>
              <h2 className="mb-10 font-headline text-4xl font-bold">Institutional Support</h2>
              <div className="space-y-12">
                <div className="flex items-start gap-8">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-white/20">
                    <Icon name="print" />
                  </div>
                  <div>
                    <h4 className="mb-2 text-lg font-bold">High-Precision Output</h4>
                    <p className="font-light text-sm leading-relaxed text-white/60">
                      Industrial grade vinyl and backlit textiles with UV-stabilized pigments
                      for consistent brand representation.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-8">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-white/20">
                    <Icon name="construction" />
                  </div>
                  <div>
                    <h4 className="mb-2 text-lg font-bold">Structural Engineering</h4>
                    <p className="font-light text-sm leading-relaxed text-white/60">
                      Deployment managed by certified rigging teams with specialized expertise
                      in high-elevation urban installs.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-8">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-white/20">
                    <Icon name="verified" />
                  </div>
                  <div>
                    <h4 className="mb-2 text-lg font-bold">Proof of Performance</h4>
                    <p className="font-light text-sm leading-relaxed text-white/60">
                      Real-time digital confirmation and daily high-resolution photo reports
                      for all active placements.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="relative flex aspect-square w-full items-center justify-center">
                <div className="absolute inset-0 animate-[spin_60s_linear_infinite] rounded-full border border-white/10" />
                <div className="absolute inset-20 animate-[spin_30s_linear_infinite_reverse] rounded-full border border-white/10" />
                <div className="border border-white/20 p-20">
                  <Icon name="shield" className="!text-8xl text-secondary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= ASSET LIQUIDITY ================= */}
      <section className="border-b border-border-subtle bg-white px-8 py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-20 md:grid-cols-2">
            <div>
              <h2 className="mb-8 font-headline text-4xl font-bold">Asset Liquidity</h2>
              <p className="mb-12 font-light text-on-surface-variant">
                Monetize premium urban surfaces through structured leasing or direct
                marketplace participation.
              </p>
              <div className="space-y-6">
                <div className="group cursor-pointer border border-border-subtle p-10 transition-colors hover:border-primary">
                  <h4 className="mb-4 flex items-center gap-3 text-xl font-bold">
                    <Icon name="contract" className="text-secondary" />
                    Fixed Lease Model
                  </h4>
                  <p className="mb-6 font-light text-sm leading-relaxed text-on-surface-variant">
                    Long-term institutional leasing with guaranteed monthly disbursements,
                    regardless of occupancy. Professional asset management included.
                  </p>
                  <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-primary transition-transform group-hover:translate-x-2">
                    Learn More &rarr;
                  </span>
                </div>

                <div className="group cursor-pointer border border-border-subtle p-10 transition-colors hover:border-primary">
                  <h4 className="mb-4 flex items-center gap-3 text-xl font-bold">
                    <Icon name="analytics" className="text-secondary" />
                    Marketplace Participation
                  </h4>
                  <p className="mb-6 font-light text-sm leading-relaxed text-on-surface-variant">
                    List assets on our institutional marketplace. Maintain control over
                    pricing while leveraging our verified buyer network.
                  </p>
                  <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-primary transition-transform group-hover:translate-x-2">
                    List Asset &rarr;
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center border border-border-subtle bg-surface p-12">
              <h3 className="mb-6 font-headline text-2xl font-bold">Ancillary Services</h3>
              <p className="mb-10 font-light text-sm text-on-surface-variant">
                Leverage our technical infrastructure for independent fulfillments.
              </p>
              <ul className="mb-12 space-y-8">
                <li className="flex items-start gap-4">
                  <Icon name="task_alt" className="text-secondary" />
                  <span className="text-sm font-semibold tracking-tight">
                    Technical Print Management (Large Format)
                  </span>
                </li>
                <li className="flex items-start gap-4">
                  <Icon name="task_alt" className="text-secondary" />
                  <span className="text-sm font-semibold tracking-tight">
                    Structural Rigging &amp; Installation Teams
                  </span>
                </li>
                <li className="flex items-start gap-4">
                  <Icon name="task_alt" className="text-secondary" />
                  <span className="text-sm font-semibold tracking-tight">
                    Post-Install Compliance Documentation
                  </span>
                </li>
              </ul>
              <button
                type="button"
                className="w-full border border-primary bg-white py-5 text-xs font-bold uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-white"
              >
                Service Quotation
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= LIST YOUR SPACE CTA ================= */}
      <section className="relative overflow-hidden bg-gradient-to-r from-primary-container to-[#1a3a5e] px-8 py-32 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 max-w-2xl">
            <div className="mb-6 flex items-center gap-4">
              <span className="h-px w-12 bg-secondary-container" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-container">
                For Media Owners
              </span>
            </div>
            <h2 className="mb-6 font-headline text-5xl font-bold md:text-6xl">
              Monetize Your Media Assets.
            </h2>
            <p className="text-lg leading-relaxed text-surface-variant">
              Connect directly with premium brands and advertising agencies. List your
              outdoor media inventory on AdSpace and unlock new revenue streams with
              transparent pricing and verified bookings.
            </p>
          </div>

          <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-secondary-container/50 bg-secondary-container/20">
                  <Icon name="rate_review" className="!text-xl text-secondary-container" />
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-bold text-white">Zero Verification Hassle</h3>
                <p className="text-sm text-surface-variant">
                  BBMP &amp; BMRCL compliant. Our team handles the bureaucracy so you don&apos;t
                  have to.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-secondary-container/50 bg-secondary-container/20">
                  <Icon name="trending_up" className="!text-xl text-secondary-container" />
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-bold text-white">Real-Time Bookings</h3>
                <p className="text-sm text-surface-variant">
                  Get instant notifications when brands book your inventory. Manage all
                  bookings from one dashboard.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-secondary-container/50 bg-secondary-container/20">
                  <Icon name="security" className="!text-xl text-secondary-container" />
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-bold text-white">Transparent Payouts</h3>
                <p className="text-sm text-surface-variant">
                  No hidden charges. Secure payments processed automatically upon campaign
                  completion.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/list-your-space"
              className="inline-block bg-secondary-container px-12 py-5 text-xs font-bold uppercase tracking-[0.15em] text-primary-container transition-all hover:bg-white"
            >
              Start Listing Your Space
            </Link>
            <button
              type="button"
              className="border-2 border-secondary-container px-12 py-5 text-xs font-bold uppercase tracking-[0.15em] text-secondary-container transition-all hover:bg-secondary-container hover:text-primary-container"
            >
              Schedule Demo Call
            </button>
          </div>
        </div>

        <div className="absolute -z-10 right-0 top-0 h-96 w-96 rounded-full bg-secondary-container/5 blur-3xl" />
        <div className="absolute -z-10 bottom-0 left-1/4 h-80 w-80 rounded-full bg-secondary-container/5 blur-3xl" />
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden bg-white px-8 py-40 text-center">
        <div className="relative z-10 mx-auto max-w-4xl">
          <h2 className="mb-10 font-headline text-5xl font-bold md:text-6xl">
            Institutional Excellence in Physical Media.
          </h2>
          <div className="flex flex-col justify-center gap-6 sm:flex-row">
            <Link
              href="/marketplace"
              className="bg-primary px-12 py-5 text-xs font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-secondary"
            >
              Explore Placements
            </Link>
            <button
              type="button"
              className="border border-primary px-12 py-5 text-xs font-bold uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-white"
            >
              Speak to an Advisor
            </button>
          </div>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/5" />
      </section>
    </>
  );
}
