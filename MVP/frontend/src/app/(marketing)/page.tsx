import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import CountUp from "@/components/marketing/CountUp";
import Reveal from "@/components/marketing/Reveal";

// Landing page — a port of the prototype's Ui_Prototype_MVP_Prep/index.html.
//
// Design register: the prototype's own. Institutional and light — off-white
// surface, navy type, a single brown-gold accent, hairline borders, square
// corners, generous py-32 rhythm, and uppercase micro-labels on wide tracking.
// Display type is Epilogue (font-headline) and the labels are Inter, matching
// the prototype; nothing here runs the dark "night" register the page used
// before.
//
// Section order, copy and layout are the prototype's, deliberately: hero →
// value pillars → marketplace selects → institutional support → asset
// liquidity → media owners → close. The two departures are:
//
//   1. Photography. The prototype's four images were AI-generated, with
//      garbled lettering on the billboards — the first detail a visitor to an
//      OOH marketplace looks at. They are replaced with the real Pexels
//      photographs already in public/images (see public/images/CREDITS.md).
//   2. Links. The prototype's static .html targets become real routes, and
//      the "Marketplace Selects" cards deep-link into the filtered
//      marketplace instead of a single hardcoded listing id, which would rot
//      the moment the catalogue is re-imported.
//
// Motion is additive only: scroll entrances via Reveal, a hero load sequence
// via `.rise`, the prototype's own counter-rotating rings in Institutional
// Support, and one count-up on the hero stat. Every one of them is neutralised
// under prefers-reduced-motion in globals.css.

const PILLARS = [
  {
    icon: "account_balance",
    title: "Financial Transparency",
    body: "Direct-to-owner pricing structures that eliminate any overhead. Real-time rate cards and transparent settlements with agreements.",
  },
  {
    icon: "architecture",
    title: "Verified Inventory",
    body: "Every location is physically audited for structural integrity, visibility angles, and lighting performance metrics.",
  },
  {
    icon: "precision_manufacturing",
    title: "Managed Fulfillment",
    body: "End-to-end logistics including large-format technical printing, certified rigging, and bi-weekly photo audits.",
  },
];

// The prototype's three select cards, re-photographed and pointed at the
// filtered marketplace. `spaceType` matches the values GET /listings filters
// on, so each card lands on real inventory.
const SELECTS = {
  feature: {
    title: "MG Road Digital Cluster",
    meta: "Financial District • Digital Network",
    price: "₹85,000",
    unit: "Per Week",
    spaceType: "Digital OOH",
    image: "/images/misc/format-digital.jpg",
    alt: "Cluster of digital advertising screens lit up over a city junction",
  },
  side: [
    {
      title: "Retail Kiosks: Mall of Asia",
      meta: "Lifestyle • 12 Units",
      spaceType: "Bus Shelter",
      image: "/images/misc/format-bus-shelter.jpg",
      alt: "Backlit street-level advertising panel beside a pavement at night",
    },
    {
      title: "Transit Network: Metro Panels",
      meta: "Commuter • 50 Stations",
      spaceType: "Skywalk",
      image: "/images/misc/format-skywalk.jpg",
      alt: "Elevated pedestrian walkway carrying advertising panels over traffic",
    },
  ],
};

const SUPPORT = [
  {
    icon: "print",
    title: "High-Precision Output",
    body: "Industrial grade vinyl and backlit textiles with UV-stabilized pigments for consistent brand representation.",
  },
  {
    icon: "construction",
    title: "Structural Engineering",
    body: "Deployment managed by certified rigging teams with specialized expertise in high-elevation urban installs.",
  },
  {
    icon: "verified",
    title: "Proof of Performance",
    body: "Real-time digital confirmation and daily high-resolution photo reports for all active placements.",
  },
];

const LIQUIDITY = [
  {
    icon: "contract",
    title: "Fixed Lease Model",
    body: "Long-term institutional leasing with guaranteed monthly disbursements, regardless of occupancy. Professional asset management included.",
    cta: "Learn More",
    href: "/partnerships",
  },
  {
    icon: "analytics",
    title: "Marketplace Participation",
    body: "List assets on our institutional marketplace. Maintain control over pricing while leveraging our verified buyer network.",
    cta: "List Asset",
    href: "/list-your-space",
  },
];

const ANCILLARY = [
  "Technical Print Management (Large Format)",
  "Structural Rigging & Installation Teams",
  "Post-Install Compliance Documentation",
];

const OWNER_POINTS = [
  {
    icon: "rate_review",
    title: "Zero Verification Hassle",
    body: "BBMP & BMRCL compliant. Our team handles the bureaucracy so you don't have to.",
  },
  {
    icon: "trending_up",
    title: "Real-Time Bookings",
    body: "Get instant notifications when brands book your inventory. Manage all bookings from one dashboard.",
  },
  {
    icon: "security",
    title: "Transparent Payouts",
    body: "No hidden charges. Secure payments processed automatically upon campaign completion.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* ===============================================
           HERO SECTION
           =============================================== */}
      <section className="relative flex min-h-[85vh] items-center overflow-hidden border-b border-border-subtle">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-8">
          <div className="grid grid-cols-1 items-stretch gap-0 lg:grid-cols-12">
            {/* Left: headline & CTA */}
            <div className="flex flex-col justify-center lg:col-span-7 lg:pr-12">
              <div
                className="rise mb-8 flex items-center gap-4"
                style={{ "--rise-delay": "80ms" } as React.CSSProperties}
              >
                <span className="h-px w-12 bg-secondary" />
                <span className="font-inter text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Bengaluru OOH Direct
                </span>
              </div>

              <h1 className="mb-8 font-headline text-5xl font-bold leading-[1.1] text-primary md:text-7xl">
                <span
                  className="rise block"
                  style={{ "--rise-delay": "160ms" } as React.CSSProperties}
                >
                  Curated Physical
                </span>
                <span
                  className="rise block font-normal italic"
                  style={{ "--rise-delay": "280ms" } as React.CSSProperties}
                >
                  Media Placements.
                </span>
              </h1>

              <p
                className="rise mb-12 max-w-lg text-lg font-light leading-relaxed text-on-surface-variant"
                style={{ "--rise-delay": "400ms" } as React.CSSProperties}
              >
                A marketplace connecting premium brands with verified high-impact
                outdoor assets. Skip the worries and secure your adspot now.
              </p>

              <div
                className="rise flex flex-wrap gap-4"
                style={{ "--rise-delay": "520ms" } as React.CSSProperties}
              >
                <Link
                  href="/marketplace"
                  className="group inline-flex items-center gap-3 bg-primary px-10 py-4 font-inter text-xs font-bold uppercase tracking-[0.15em] text-white transition-all hover:bg-secondary"
                >
                  View Inventory
                  <Icon
                    name="arrow_forward"
                    className="!text-base transition-transform group-hover:translate-x-1"
                  />
                </Link>
                <Link
                  href="/support"
                  className="inline-flex items-center border border-primary px-10 py-4 font-inter text-xs font-bold uppercase tracking-[0.15em] text-primary transition-all hover:bg-primary hover:text-white"
                >
                  Request Proposal
                </Link>
              </div>
            </div>

            {/* Right: hero photograph + overlapping stat card */}
            <div
              className="rise relative mt-16 lg:col-span-5 lg:mt-0"
              style={{ "--rise-delay": "640ms" } as React.CSSProperties}
            >
              <div className="group relative z-10 aspect-[4/5] w-full border border-primary/10 lg:aspect-auto lg:h-full">
                <Image
                  src="/images/hero/landing-hero.jpg"
                  alt="Lit hoardings above night traffic on a city arterial road"
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover grayscale-[20%] transition-all duration-700 group-hover:grayscale-0"
                />
              </div>

              <div className="absolute -bottom-6 right-4 z-20 min-w-[240px] border border-border-subtle bg-white p-8 shadow-sm sm:-right-6">
                <div className="mb-1 font-headline text-4xl font-bold text-primary">
                  <CountUp to={250} suffix="K+" />
                </div>
                <div className="font-inter text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Daily Reach / MG Road
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Background grid pattern */}
        <div className="architectural-grid pointer-events-none absolute inset-0 -z-10 opacity-30" />
      </section>

      {/* ===============================================
           CORE VALUE PILLARS SECTION
           =============================================== */}
      <section className="bg-white px-6 py-24 sm:px-8 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
            {PILLARS.map((pillar, i) => (
              <Reveal key={pillar.title} delay={i * 110} className="space-y-6">
                <div className="text-secondary">
                  <Icon name={pillar.icon} className="!text-4xl" />
                </div>
                <h3 className="font-headline text-xl font-bold tracking-tight text-primary">
                  {pillar.title}
                </h3>
                <p className="text-sm font-light leading-relaxed text-on-surface-variant">
                  {pillar.body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===============================================
           MARKETPLACE SELECTS SECTION
           =============================================== */}
      <section className="bg-surface px-6 py-24 sm:px-8 md:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-16 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="mb-4 font-headline text-4xl font-bold text-primary">
                Marketplace Selects
              </h2>
              <div className="h-1 w-20 bg-primary" />
            </div>
            <Link
              href="/marketplace"
              className="group flex items-center gap-2 font-inter text-xs font-bold uppercase tracking-widest text-primary transition-colors hover:text-secondary"
            >
              All Placements
              <Icon
                name="north_east"
                className="!text-sm transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          </Reveal>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            {/* Feature card */}
            <Reveal className="md:col-span-7">
              <Link
                href={`/marketplace?space_type=${encodeURIComponent(SELECTS.feature.spaceType)}`}
                className="group flex h-full cursor-pointer flex-col overflow-hidden border border-border-subtle bg-white transition-colors hover:border-primary"
              >
                {/* Grid items stretch, and the two stacked side cards are the
                    taller column — so the photograph takes the slack rather
                    than leaving a blank panel under the caption. */}
                <div className="relative aspect-[16/9] flex-1 overflow-hidden md:aspect-auto md:min-h-[20rem]">
                  <Image
                    src={SELECTS.feature.image}
                    alt={SELECTS.feature.alt}
                    fill
                    sizes="(min-width: 768px) 58vw, 100vw"
                    className="object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
                  />
                </div>
                <div className="p-8">
                  <div className="mb-4 flex items-start justify-between gap-6">
                    <div>
                      <h3 className="mb-1 font-headline text-2xl font-bold text-primary">
                        {SELECTS.feature.title}
                      </h3>
                      <p className="text-sm font-light text-on-surface-variant">
                        {SELECTS.feature.meta}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-inter text-lg font-bold text-primary">
                        {SELECTS.feature.price}
                      </div>
                      <div className="font-inter text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {SELECTS.feature.unit}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </Reveal>

            {/* Side cards */}
            <div className="flex flex-col gap-8 md:col-span-5">
              {SELECTS.side.map((card, i) => (
                <Reveal key={card.title} delay={120 + i * 120} className="h-full">
                  <Link
                    href={`/marketplace?space_type=${encodeURIComponent(card.spaceType)}`}
                    className="group flex h-full cursor-pointer flex-col overflow-hidden border border-border-subtle bg-white transition-colors hover:border-primary"
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <Image
                        src={card.image}
                        alt={card.alt}
                        fill
                        sizes="(min-width: 768px) 40vw, 100vw"
                        className="object-cover grayscale transition-all duration-700 group-hover:grayscale-0"
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="mb-1 font-headline text-lg font-bold text-primary">
                        {card.title}
                      </h3>
                      <p className="text-xs font-light text-on-surface-variant">
                        {card.meta}
                      </p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===============================================
           INSTITUTIONAL SUPPORT SECTION
           =============================================== */}
      <section className="relative overflow-hidden bg-primary px-6 py-24 text-white sm:px-8 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-24">
            {/* Features list */}
            <div>
              <Reveal>
                <h2 className="mb-10 font-headline text-4xl font-bold">
                  Institutional Support
                </h2>
              </Reveal>
              <div className="space-y-12">
                {SUPPORT.map((item, i) => (
                  <Reveal key={item.title} delay={120 + i * 110}>
                    <div className="flex items-start gap-6 sm:gap-8">
                      <div className="hairline-light flex h-12 w-12 shrink-0 items-center justify-center border text-accent">
                        <Icon name={item.icon} />
                      </div>
                      <div>
                        <h4 className="mb-2 text-lg font-bold">{item.title}</h4>
                        <p className="text-sm font-light leading-relaxed text-white/60">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* Counter-rotating rings — the prototype's own flourish. */}
            <div className="hidden lg:block">
              <div className="relative flex aspect-square w-full items-center justify-center">
                <div className="ring-slow absolute inset-0 rounded-full border border-white/10" />
                <div className="ring-fast absolute inset-20 rounded-full border border-white/10" />
                <div className="border border-white/20 p-20">
                  <Icon name="shield" className="!text-8xl text-secondary-container" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===============================================
           ASSET LIQUIDITY SECTION
           =============================================== */}
      <section className="border-b border-border-subtle bg-white px-6 py-24 sm:px-8 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2 md:gap-20">
            {/* Monetization models */}
            <div>
              <Reveal>
                <h2 className="mb-8 font-headline text-4xl font-bold text-primary">
                  Asset Liquidity
                </h2>
                <p className="mb-12 font-light text-on-surface-variant">
                  Monetize premium urban surfaces through structured leasing or
                  direct marketplace participation.
                </p>
              </Reveal>
              <div className="space-y-6">
                {LIQUIDITY.map((model, i) => (
                  <Reveal key={model.title} delay={140 + i * 120}>
                    <Link
                      href={model.href}
                      className="group block border border-border-subtle p-8 transition-colors hover:border-primary lg:p-10"
                    >
                      <h4 className="mb-4 flex items-center gap-3 font-headline text-xl font-bold text-primary">
                        <Icon name={model.icon} className="text-secondary" />
                        {model.title}
                      </h4>
                      <p className="mb-6 text-sm font-light leading-relaxed text-on-surface-variant">
                        {model.body}
                      </p>
                      <span className="inline-block font-inter text-[10px] font-bold uppercase tracking-[0.2em] text-primary transition-transform group-hover:translate-x-2">
                        {model.cta} →
                      </span>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* Ancillary services */}
            <Reveal delay={200}>
              <div className="flex h-full flex-col justify-center border border-border-subtle bg-surface p-8 sm:p-12">
                <h3 className="mb-6 font-headline text-2xl font-bold text-primary">
                  Ancillary Services
                </h3>
                <p className="mb-10 text-sm font-light text-on-surface-variant">
                  Leverage our technical infrastructure for independent
                  fulfillments.
                </p>
                <ul className="mb-12 space-y-8">
                  {ANCILLARY.map((service) => (
                    <li key={service} className="flex items-start gap-4">
                      <Icon name="task_alt" className="shrink-0 text-secondary" />
                      <span className="text-sm font-semibold tracking-tight text-primary">
                        {service}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/support"
                  className="w-full border border-primary bg-white py-5 text-center font-inter text-xs font-bold uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-white"
                >
                  Service Quotation
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===============================================
           LIST YOUR SPACE SECTION
           =============================================== */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#0a1f44] to-[#1a3a5e] px-6 py-24 text-white sm:px-8 md:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal className="mb-16 max-w-2xl">
            <div className="mb-6 flex items-center gap-4">
              <span className="h-px w-12 bg-accent" />
              <span className="font-inter text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
                For Media Owners
              </span>
            </div>
            <h2 className="mb-6 font-headline text-4xl font-bold sm:text-5xl md:text-6xl">
              Monetize Your Media Assets.
            </h2>
            <p className="text-lg leading-relaxed text-surface-variant">
              Connect directly with premium brands and advertising agencies. List
              your outdoor media inventory on AdSpace Horizon and unlock new
              revenue streams with transparent pricing and verified bookings.
            </p>
          </Reveal>

          <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {OWNER_POINTS.map((point, i) => (
              <Reveal key={point.title} delay={140 + i * 110}>
                <div className="flex gap-4">
                  <div className="shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent/50 bg-accent/20">
                      <Icon name={point.icon} className="!text-xl text-accent" />
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 font-bold text-white">{point.title}</h3>
                    <p className="text-sm text-surface-variant">{point.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={480} className="flex flex-wrap gap-4">
            <Link
              href="/list-your-space"
              className="inline-block bg-accent px-10 py-5 font-inter text-xs font-bold uppercase tracking-[0.15em] text-[#0a1f44] transition-all hover:bg-white sm:px-12"
            >
              Start Listing Your Space
            </Link>
            <Link
              href="/support"
              className="inline-block border-2 border-accent px-10 py-5 font-inter text-xs font-bold uppercase tracking-[0.15em] text-accent transition-all hover:bg-accent hover:text-[#0a1f44] sm:px-12"
            >
              Schedule Demo Call
            </Link>
          </Reveal>
        </div>

        {/* Background decoration */}
        <div className="pointer-events-none absolute right-0 top-0 -z-10 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 -z-10 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />
      </section>

      {/* ===============================================
           FINAL CTA SECTION
           =============================================== */}
      <section className="relative overflow-hidden bg-white px-6 py-28 text-center sm:px-8 md:py-40">
        <Reveal className="relative z-10 mx-auto max-w-4xl">
          <h2 className="mb-10 font-headline text-4xl font-bold text-primary sm:text-5xl md:text-6xl">
            Institutional Excellence in Physical Media.
          </h2>
          <div className="flex flex-col justify-center gap-6 sm:flex-row">
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center bg-primary px-10 py-5 font-inter text-xs font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-secondary sm:px-12"
            >
              Explore Placements
            </Link>
            <Link
              href="/support"
              className="inline-flex items-center justify-center border border-primary px-10 py-5 font-inter text-xs font-bold uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-white sm:px-12"
            >
              Speak to an Advisor
            </Link>
          </div>
        </Reveal>

        {/* Background decoration */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/5" />
      </section>
    </>
  );
}
