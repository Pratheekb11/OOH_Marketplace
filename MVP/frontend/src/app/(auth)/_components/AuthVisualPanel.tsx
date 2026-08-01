import Image from "next/image";
import type { ReactNode } from "react";

interface AuthVisualPanelProps {
  headline?: ReactNode;
  lede?: string;
}

// Server Component — the left "landing-section" brand panel from
// login_Page.html (lines ~56-89), shared between /login and /register so
// the split screen stays visually identical on both. Purely presentational,
// no auth-state dependency, so it's safe as a plain server-rendered island.
export function AuthVisualPanel({
  headline = (
    <>
      Where Physicality <br />
      Meets Precision.
    </>
  ),
  lede = "Connect with premium inventory across the globe. Secure your space in the physical world with digital intelligence.",
}: AuthVisualPanelProps) {
  return (
    <div className="relative hidden w-5/12 flex-col justify-end overflow-hidden bg-primary-container p-16 md:flex">
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero/login-hero.png"
          alt="Modern architectural glass building with vibrant sunset reflecting"
          fill
          priority
          sizes="42vw"
          className="object-cover opacity-40"
        />
      </div>

      <div className="relative z-10 space-y-6">
        <h1 className="font-headline text-5xl font-extrabold leading-tight tracking-tighter text-white">
          {headline}
        </h1>
        <p className="max-w-sm text-lg font-medium text-on-primary-container">{lede}</p>

        <div className="flex gap-4 pt-8">
          <div className="flex -space-x-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-primary-container bg-surface-dim">
              <Image
                src="/images/avatars/login-face-1.png"
                alt="Business executive professional portrait"
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-primary-container bg-surface-dim">
              <Image
                src="/images/avatars/login-face-2.png"
                alt="Professional woman in office environment"
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <div className="glass-panel flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary-container text-xs font-bold text-white">
              +12k
            </div>
          </div>
          <div className="text-sm text-white">
            <div className="font-bold">Trusted by Industry Leaders</div>
            <div className="text-on-primary-container">Advertisers &amp; Space Owners</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthVisualPanel;
