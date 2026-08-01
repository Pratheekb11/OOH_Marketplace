import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";

export const metadata = {
  title: "Partnerships | AdSpace",
  description: "Institutional partnerships, compliance, and agency benefits for AdSpace's Bengaluru OOH inventory.",
};

// Ported from Ui_Prototype_MVP_Prep/Partnerships.html + css/partnerships.css.
// Never carried over before this pass (proof: the 5 downloaded images below
// had zero references anywhere in src/). NavShellA/SiteFooter come from
// (marketing)/layout.tsx — no nav or footer markup here.
//
// The prototype's nav/footer both said "OOH Marketplace(/Horizon)"; this
// build's brand is AdSpace ("one stop for your OOH needs" — see SiteFooter),
// so body copy referring to the brand uses AdSpace, not the prototype's name.
// The trust-bar/brand-scroll/bento sections are the prototype's own
// marketing copy (BBMP/BMRCL claims, "TATA MOTORS" logo-wall, rebate %s) —
// kept as flavor copy for a partnerships pitch page, not presented as
// measured product data (unlike the Analytics page, nothing here claims to
// be a live number pulled from this app's real bookings).
export default function PartnershipsPage() {
  return (
    <main>
      {/* ================= HERO ================= */}
      <section className="relative flex min-h-[80vh] w-full items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/misc/partnerships-hero-skyline.png"
            alt="Bengaluru skyline at dusk"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center brightness-[0.45] grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/70 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-8">
          <div className="max-w-2xl space-y-8">
            <span className="inline-block rounded-full bg-secondary-container/10 px-4 py-1.5 font-label text-sm font-bold uppercase tracking-widest text-secondary-container">
              Institutional Excellence
            </span>

            <h1 className="font-headline text-5xl font-extrabold leading-none tracking-tighter text-white md:text-7xl">
              Infrastructure of <br /> Modern Advertising
            </h1>

            <p className="max-w-xl text-lg font-light leading-relaxed text-surface-container-high md:text-xl">
              Setting the standard for OOH inventory in India&apos;s Silicon Valley. AdSpace bridges
              the gap between institutional compliance and digital agility.
            </p>

            <div className="flex flex-wrap gap-6 pt-4">
              <Button href="/list-your-space" variant="gradient" size="lg">
                Become a Partner
              </Button>
              <Link
                href="/support"
                className="rounded-md border-b-2 border-white/20 px-8 py-4 text-lg font-bold text-white transition-colors hover:border-white"
              >
                Compliance Overview
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TRUST BAR ================= */}
      <section className="bg-surface-container-low py-12">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-12 px-8">
          {[
            { icon: "verified_user", title: "BBMP Authorized", detail: "Regulatory License #2024-AD-BLR" },
            { icon: "train", title: "BMRCL Exclusive", detail: "Namma Metro Transit Rights" },
            { icon: "gavel", title: "Legal Compliance", detail: "Zero-Deviation Policy" },
            { icon: "location_on", title: "Strategic Zoning", detail: "Tier-1 Bengaluru Precincts" },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                <Icon name={item.icon} fill={1} className="!text-3xl text-secondary" />
              </div>
              <div>
                <h4 className="font-headline font-bold text-on-surface">{item.title}</h4>
                <p className="text-sm text-on-surface-variant">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= PARTNERSHIP PILLARS ================= */}
      <section className="bg-white py-32">
        <div className="mx-auto max-w-7xl px-8">
          <div className="mb-24 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <h2 className="mb-6 font-headline text-4xl font-black leading-tight text-primary md:text-5xl">
                The Three Pillars of Institutional Trust
              </h2>
              <p className="text-lg text-on-surface-variant">
                Our methodology ensures that every billboard and digital screen is more than
                just space—it&apos;s a certified urban asset.
              </p>
            </div>
            <div className="hidden h-px flex-grow bg-surface-container-highest lg:block" />
            <span className="select-none font-headline text-8xl font-black text-surface-container-low md:text-9xl">
              03
            </span>
          </div>

          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            {[
              {
                image: "/images/misc/partnerships-law-office.png",
                alt: "Modern law office interior",
                title: "Legal Compliance",
                body: "Every site is vetted for adherence to BBMP Outdoor Advertising Policy. Verified permits are accessible on request.",
                points: ["GST & Tax Clearance", "Structural Stability Certificates"],
              },
              {
                image: "/images/misc/partnerships-skyscraper.png",
                alt: "Modern skyscraper facade",
                title: "Urban Integration",
                body: "Strategic placement designed to complement Bengaluru's urban fabric — prioritizing aesthetics and visual harmony in Tier-1 corridors like MG Road and Outer Ring Road.",
                points: ["Premium Site Maintenance", "Traffic Flow Analytics"],
              },
              {
                image: "/images/misc/partnerships-community.png",
                alt: "Diverse group of people in an urban plaza",
                title: "Community First",
                body: "Citizen safety and environmental responsibility come first — energy-efficient lighting with zero interference with public lighting or emergency signals.",
                points: ["Low-Carbon Operations", "Public Utility Integration"],
              },
            ].map((pillar) => (
              <div key={pillar.title} className="group space-y-6">
                <div className="mb-2 aspect-[4/5] overflow-hidden rounded-xl shadow-sm">
                  <Image
                    src={pillar.image}
                    alt={pillar.alt}
                    width={512}
                    height={512}
                    className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0"
                  />
                </div>
                <h3 className="font-headline text-2xl font-extrabold text-on-surface">{pillar.title}</h3>
                <p className="leading-relaxed text-on-surface-variant">{pillar.body}</p>
                <ul className="space-y-3 font-label text-sm font-semibold text-secondary">
                  {pillar.points.map((point) => (
                    <li key={point} className="flex items-center gap-2">
                      <Icon name="check_circle" className="!text-sm" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= BRAND TRUST ================= */}
      <section className="overflow-hidden bg-surface-container-low py-24">
        <div className="mx-auto mb-16 max-w-7xl px-8 text-center">
          <h3 className="mb-4 font-label text-xs font-black uppercase tracking-[0.3em] text-on-surface-variant">
            Trusted by the Titans
          </h3>
          <div className="mx-auto h-px w-24 bg-secondary" />
        </div>
        <div className="flex flex-wrap justify-center gap-16 px-8 opacity-40 transition-opacity hover:opacity-80">
          {["TATA MOTORS", "INFOSYS", "ZEPTO", "AMAZON", "PHONEPE", "TITAN", "FLIPKART", "OLA ELECTRIC"].map(
            (brand) => (
              <span key={brand} className="whitespace-nowrap font-headline text-2xl font-black italic tracking-tighter md:text-3xl">
                {brand}
              </span>
            ),
          )}
        </div>
      </section>

      {/* ================= AGENCY BENEFITS (BENTO) ================= */}
      <section className="bg-[#f9f9ff] px-8 py-32">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-20 font-headline text-4xl font-black text-on-surface md:text-5xl">
            Agency Exclusive Benefits
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Large primary card */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-primary p-12 text-white md:col-span-8 md:row-span-2">
              <div className="pointer-events-none absolute right-0 top-0 p-8 opacity-10">
                <Icon name="payments" className="!text-[12rem]" />
              </div>
              <div className="relative z-10 max-w-lg space-y-6">
                <span className="font-label text-sm font-bold uppercase tracking-widest text-secondary">
                  Tier 1 Agencies
                </span>
                <h3 className="font-headline text-3xl font-extrabold leading-tight md:text-4xl">
                  Institutional Volume Rebates
                </h3>
                <p className="text-lg leading-relaxed text-on-primary-container">
                  Scale your campaigns with preferential pricing. Agencies managing portfolios
                  over ₹50,00,000 per quarter unlock exclusive cash-back rebates.
                </p>
              </div>
              <div className="relative z-10 flex items-end justify-between">
                <div className="font-headline text-5xl font-black">
                  12%<span className="ml-2 text-xl font-normal text-on-primary-container">Rebate Floor</span>
                </div>
                <Link
                  href="/support"
                  aria-label="Learn more about agency rebates"
                  className="flex items-center justify-center rounded-full bg-secondary p-4"
                >
                  <Icon name="arrow_forward" className="text-white" />
                </Link>
              </div>
            </div>

            {/* Side card top */}
            <div className="flex flex-col justify-between rounded-xl border-b-4 border-secondary bg-surface-container-high p-8 md:col-span-4">
              <div className="space-y-4">
                <Icon name="api" fill={1} className="!text-4xl text-secondary" />
                <h4 className="font-headline text-xl font-extrabold text-primary">API Direct Integration</h4>
                <p className="text-sm text-on-surface-variant">
                  Real-time occupancy tracking and performance metrics directly into your
                  internal dashboard.
                </p>
              </div>
              <div className="text-xs font-bold uppercase tracking-widest text-secondary-container">
                v2.4 Live Now
              </div>
            </div>

            {/* Side card bottom */}
            <div className="flex flex-col justify-between rounded-xl border-b-4 border-primary-container bg-surface-container-highest p-8 md:col-span-4">
              <div className="space-y-4">
                <Icon name="calendar_today" className="!text-4xl text-primary" />
                <h4 className="font-headline text-xl font-extrabold text-primary">Pre-sale Early Access</h4>
                <p className="text-sm text-on-surface-variant">
                  48-hour head start on prime festive inventory at Hebbal, Indiranagar, and
                  Koramangala.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-primary-container">
                <Icon name="notifications_active" className="!text-xs" />
                ALERTS ENABLED
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="py-32">
        <div className="mx-auto max-w-7xl px-8">
          <div className="grid min-h-[500px] grid-cols-1 overflow-hidden rounded-xl bg-primary-container md:grid-cols-2">
            <div className="flex flex-col justify-center gap-10 p-10 md:p-16">
              <h2 className="font-headline text-4xl font-black leading-tight text-white md:text-5xl">
                Secure Your Presence in Bengaluru.
              </h2>

              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <Icon name="domain" className="text-secondary-container" />
                  <div>
                    <h5 className="mb-1 font-bold text-white">Bengaluru Headquarters</h5>
                    <p className="text-sm text-on-primary-container">
                      Prestige Trade Tower, Palace Road,
                      <br />
                      Bengaluru, Karnataka 560001
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Icon name="call" className="text-secondary-container" />
                  <div>
                    <h5 className="mb-1 font-bold text-white">Partnership Desk</h5>
                    <p className="text-sm text-on-primary-container">
                      +91 (80) 4555 9900
                      <br />
                      partners@adspace.example
                    </p>
                  </div>
                </div>
              </div>

              <Button
                href="mailto:partners@adspace.example"
                variant="gradient"
                size="lg"
                className="w-full py-5 text-xl"
              >
                Schedule a Consultation
              </Button>
            </div>

            <div className="relative min-h-[320px] md:min-h-[400px]">
              <Image
                src="/images/misc/partnerships-cta-desk.png"
                alt="Office desk with architectural blueprints"
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-primary-container/20 mix-blend-multiply" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
