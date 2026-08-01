import Link from "next/link";
import Icon from "@/components/ui/Icon";

interface FooterLink {
  label: string;
  href: string;
}

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h5 className="mb-8 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">{title}</h5>
      <ul className="space-y-4 text-xs font-medium">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="transition-colors hover:text-secondary">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 4-column footer, ported from index.html. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle bg-white text-primary">
      <div className="mx-auto max-w-7xl px-8 py-20">
        <div className="grid grid-cols-1 gap-16 md:grid-cols-4">
          <div className="col-span-1 md:col-span-1">
            <div className="mb-6 font-headline text-lg font-extrabold uppercase">
              Ad<span className="text-secondary">Space</span>
            </div>
            <p className="mb-8 text-xs font-light leading-relaxed text-on-surface-variant opacity-70">
              One stop for your OOH needs. Institutional physical advertising marketplace.
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">
              &copy; {new Date().getFullYear()} AdSpace
            </p>
          </div>

          <FooterColumn
            title="Platform"
            links={[
              { label: "Inventory Map", href: "/marketplace" },
              { label: "Asset Owners", href: "/list-your-space" },
              { label: "Partnerships", href: "/partnerships" },
              { label: "VAS Fulfillment", href: "/support" },
            ]}
          />

          {/* Terms of Service / Privacy Protocol / Compliance have no real
              pages in this build — routed to /support rather than left as
              "#" or invented outright; the FAQ there says legal docs land
              in a later milestone. */}
          <FooterColumn
            title="Legal"
            links={[
              { label: "Terms of Service", href: "/support" },
              { label: "Privacy Protocol", href: "/support" },
              { label: "Compliance", href: "/support" },
            ]}
          />

          <div>
            <h5 className="mb-8 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">Insights</h5>
            <p className="mb-6 text-xs font-light text-on-surface-variant">Professional OOH market analysis.</p>
            <div className="flex">
              <input
                className="w-full border border-border-subtle bg-surface px-4 py-3 text-xs focus:border-primary focus:ring-0"
                placeholder="Professional Email"
                type="email"
              />
              <button
                type="button"
                aria-label="Subscribe"
                className="bg-primary px-4 py-3 text-white transition-colors hover:bg-secondary"
              >
                <Icon name="east" className="text-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
