import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import HeroSlots from "@/components/marketing/HeroSlots";
import Reveal from "@/components/marketing/Reveal";

// Landing page.
//
// Design register: "night". Out-of-home is a business of lit surfaces, so the
// page runs on two light temperatures — sodium amber (--color-accent) against
// a cold near-black — and lets the photography carry the rest of the colour.
// Display type is Syne (already loaded in the root layout, previously unused);
// body stays Manrope; Inter carries the data/labels.
//
// The one signature element is the hero's play-out loop (HeroSlots): digital
// OOH is sold as a rotation, so the first thing a visitor sees behaves like
// the medium being sold. Everything around it stays quiet.
//
// Numbers below are the real catalogue (MVP/frontend/public/data/listings.json:
// 2,114 rows, 2,113 of them Bengaluru — Bus Shelter 1,101, Hoarding 710, Skywalk 151,
// Digital OOH 124; ₹400–₹1,26,667 per day). Re-check them when the snapshot is
// regenerated (`python -m scripts.export_static`).

const FORMATS = [
  {
    name: "Hoardings",
    count: "710 sites",
    blurb: "Arterial roads and highways, sold by the panel. Front-lit, back-lit or unlit.",
    image: "/images/misc/format-hoarding.jpg",
    alt: "Large roadside hoarding above city traffic at dusk",
    spaceType: "Hoarding",
  },
  {
    name: "Bus shelters",
    count: "1,101 sites",
    blurb: "Backlit panels at eye level, priced by a small, medium or large bucket.",
    image: "/images/misc/format-bus-shelter.jpg",
    alt: "Illuminated bus shelter advertising panel on a wet street at night",
    spaceType: "Bus Shelter",
  },
  {
    name: "Skywalks",
    count: "151 sites",
    blurb: "Foot-over-bridge wraps and deck panels, read by traffic underneath.",
    image: "/images/misc/format-skywalk.jpg",
    alt: "Elevated pedestrian skywalk crossing a busy city street",
    spaceType: "Skywalk",
  },
  {
    name: "Digital OOH",
    count: "124 sites",
    blurb: "LED screens sold in rotating slots, priced per day of the loop.",
    image: "/images/misc/format-digital.jpg",
    alt: "Cluster of digital advertising screens lit up at night",
    spaceType: "Digital OOH",
  },
];

// A genuine sequence — this is the order a campaign actually happens in, which
// is the only reason the steps carry numbers.
const STEPS = [
  {
    title: "Pick your sites",
    body: "Filter by area, format, size, lighting and price. Every listing shows its rate per day and what the panel actually is.",
  },
  {
    title: "Book your dates",
    body: "Availability is live. Choose the run, pay online, and the site is held for exactly those days.",
  },
  {
    title: "We print and install",
    body: "Large-format print, certified riggers, permits and paperwork. Add it at checkout or bring your own printer.",
  },
  {
    title: "You get proof",
    body: "Dated photos of your creative on the site, plus a GST invoice you can file.",
  },
];

const OWNER_POINTS = [
  { icon: "sell", title: "You set the rate", body: "Your price per day, your minimum run. We never mark it up behind your back." },
  { icon: "event_available", title: "You control the calendar", body: "Block dates you have already sold offline. The listing stays in sync." },
  { icon: "payments", title: "Paid after the run", body: "Payouts settle when the campaign completes, against a GST invoice." },
];

export default function LandingPage() {
  return (
    <>
      {/* ================= HERO =================
          Full-bleed night photograph: an arterial road after dark, a lit
          hoarding, traffic. The headline sits in the sky, which is the only
          part of the frame quiet enough to hold type. */}
      <section className="night relative isolate min-h-[100svh] overflow-hidden">
        <Image
          src="/images/hero/landing-hero.jpg"
          alt="Lit hoardings above night traffic on a city arterial road"
          fill
          priority
          sizes="100vw"
          className="object-cover brightness-110"
          style={{ objectPosition: "center 42%" }}
        />
        {/* Two scrims: one for the type column, one to seat the section on
            the black that follows it. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#05070f] via-[#05070f]/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070f] via-transparent to-[#05070f]/45" />

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl items-center px-6 pb-16 pt-28 sm:px-8">
          <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-8">
            <p
              className="rise mb-7 flex items-center gap-3 font-inter text-[11px] font-semibold uppercase tracking-[0.28em] text-accent"
              style={{ "--rise-delay": "80ms" } as React.CSSProperties}
            >
              <span className="h-px w-10 bg-accent" />
              Bengaluru out-of-home
            </p>

            <h1 className="font-syne text-[clamp(1.95rem,4.3vw,3.6rem)] font-extrabold leading-[0.95] tracking-[-0.03em] text-white">
              {/* The three-line break is a desktop composition; below sm the
                  headline flows as one sentence rather than breaking twice. */}
              <span className="rise inline sm:block" style={{ "--rise-delay": "160ms" } as React.CSSProperties}>
                Book a <span className="text-accent">billboard</span>
              </span>{" "}
              <span className="rise inline sm:block" style={{ "--rise-delay": "260ms" } as React.CSSProperties}>
                the way you book
              </span>{" "}
              <span className="rise inline sm:block" style={{ "--rise-delay": "360ms" } as React.CSSProperties}>
                a flight.
              </span>
            </h1>

            <p
              className="rise mt-7 max-w-xl text-base font-light leading-relaxed text-white/70 md:text-lg"
              style={{ "--rise-delay": "460ms" } as React.CSSProperties}
            >
              2,114 verified sites — hoardings, bus shelters, skywalks and
              digital screens. Published rates, live dates, print and install on the same bill.
            </p>

            <div
              className="rise mt-9 flex flex-wrap items-center gap-4"
              style={{ "--rise-delay": "560ms" } as React.CSSProperties}
            >
              <Link
                href="/marketplace"
                className="group inline-flex w-full items-center justify-center gap-3 bg-accent px-9 py-4 font-inter text-xs font-bold uppercase tracking-[0.18em] text-[#05070f] transition-colors hover:bg-white sm:w-auto"
              >
                Browse inventory
                <Icon name="arrow_forward" className="!text-base transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/list-your-space"
                className="inline-flex w-full items-center justify-center gap-3 border border-white/25 px-9 py-4 font-inter text-xs font-bold uppercase tracking-[0.18em] text-white transition-colors hover:border-accent hover:text-accent sm:w-auto"
              >
                List your space
              </Link>
            </div>
          </div>

          <div className="flex justify-start lg:col-span-4 lg:justify-end">
            <div className="rise w-full max-w-sm" style={{ "--rise-delay": "700ms" } as React.CSSProperties}>
              <HeroSlots />
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ================= FORMATS =================
          Continues the night without a seam. The tiles are the four formats
          that actually exist in the catalogue, each linking straight into the
          filtered marketplace. */}
      <section className="night px-6 py-24 sm:px-8 md:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-4 font-inter text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
                What you can buy
              </p>
              <h2 className="max-w-md font-syne text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
                Four formats, one checkout.
              </h2>
            </div>
            <Link
              href="/marketplace"
              className="group inline-flex shrink-0 items-center gap-2 font-inter text-xs font-bold uppercase tracking-[0.18em] text-white/60 transition-colors hover:text-accent"
            >
              See all 2,114
              <Icon name="north_east" className="!text-sm transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </Reveal>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FORMATS.map((format, i) => (
              <Reveal key={format.name} delay={i * 90}>
                <Link
                  href={`/marketplace?space_type=${encodeURIComponent(format.spaceType)}`}
                  className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden border border-white/10 transition-colors hover:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Image
                    src={format.image}
                    alt={format.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover brightness-[0.82] saturate-[0.95] transition-all duration-700 group-hover:scale-[1.04] group-hover:brightness-100 group-hover:saturate-100"
                  />
                  <div className="tile-scrim absolute inset-0" />

                  <div className="relative p-6">
                    <span className="mb-4 block h-px w-8 bg-accent transition-all duration-500 group-hover:w-16" />
                    <h3 className="font-syne text-xl font-bold text-white">{format.name}</h3>
                    <p className="mt-1 font-inter text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                      {format.count}
                    </p>
                    <p className="mt-3 text-xs font-light leading-relaxed text-white/60">
                      {format.blurb}
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="bg-surface px-6 py-24 sm:px-8 md:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-16 max-w-2xl">
            <p className="mb-4 font-inter text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">
              How a campaign runs
            </p>
            <h2 className="font-syne text-4xl font-bold leading-tight tracking-tight text-primary md:text-5xl">
              Four steps, start to proof.
            </h2>
          </Reveal>

          <ol className="grid grid-cols-1 gap-px border border-border-subtle bg-border-subtle md:grid-cols-2 lg:grid-cols-4 [&>li]:min-w-0">
            {STEPS.map((step, i) => (
              <Reveal as="li" key={step.title} delay={i * 90} className="bg-white">
                <div className="group h-full p-8 transition-colors hover:bg-surface-container-low lg:p-10">
                  <span className="font-syne text-sm font-bold tabular-nums text-secondary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="my-5 block h-px w-full bg-border-subtle transition-colors group-hover:bg-secondary" />
                  <h3 className="mb-3 font-syne text-lg font-bold text-primary">{step.title}</h3>
                  <p className="text-sm font-light leading-relaxed text-on-surface-variant">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= FOR MEDIA OWNERS ================= */}
      <section className="night relative isolate overflow-hidden">
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-2">
          <div className="relative order-2 min-h-[22rem] lg:order-1 lg:min-h-full">
            <Image
              src="/images/misc/owner-night.jpg"
              alt="A building facade carrying a large illuminated advertising screen at night"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover brightness-90"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#05070f] lg:to-[#05070f]/95" />
          </div>

          <div className="order-1 px-6 py-24 sm:px-8 lg:order-2 lg:max-w-2xl lg:py-32 lg:pl-16 lg:pr-8">
            <Reveal>
              <p className="mb-4 flex items-center gap-3 font-inter text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
                <span className="h-px w-10 bg-accent" />
                For media owners
              </p>
              <h2 className="max-w-lg font-syne text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
                Own a wall? Put it on the map.
              </h2>
              <p className="mt-6 max-w-lg text-base font-light leading-relaxed text-white/65">
                Listing is free. Send us the site, the size and your rate — we verify it,
                put it in front of brands and agencies, and handle the booking, the print
                and the install.
              </p>
            </Reveal>

            <ul className="mt-12 space-y-8">
              {OWNER_POINTS.map((point, i) => (
                <Reveal as="li" key={point.title} delay={120 + i * 90}>
                  <div className="flex gap-5">
                    <span className="hairline-light flex h-11 w-11 shrink-0 items-center justify-center border text-accent">
                      <Icon name={point.icon} className="!text-lg" />
                    </span>
                    <div>
                      <h3 className="font-syne text-base font-bold text-white">{point.title}</h3>
                      <p className="mt-1.5 text-sm font-light leading-relaxed text-white/55">
                        {point.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>

            <Reveal delay={420} className="mt-12">
              <Link
                href="/list-your-space"
                className="group inline-flex items-center gap-3 bg-accent px-9 py-4 font-inter text-xs font-bold uppercase tracking-[0.18em] text-[#05070f] transition-colors hover:bg-white"
              >
                List your space
                <Icon name="arrow_forward" className="!text-base transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= CLOSE ================= */}
      <section className="border-t border-border-subtle bg-white px-6 py-24 sm:px-8 md:py-28">
        <Reveal className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-10 md:flex-row md:items-center">
          <h2 className="max-w-md font-syne text-3xl font-bold leading-tight tracking-tight text-primary md:text-4xl">
            See what&apos;s free in your area this week.
          </h2>
          <div className="flex shrink-0 flex-wrap gap-4">
            <Link
              href="/marketplace"
              className="group inline-flex items-center gap-3 bg-primary px-9 py-4 font-inter text-xs font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-secondary"
            >
              Browse inventory
              <Icon name="arrow_forward" className="!text-base transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/support"
              className="inline-flex items-center border border-primary px-9 py-4 font-inter text-xs font-bold uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Talk to us
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
