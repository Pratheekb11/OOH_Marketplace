"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { currentMapsProvider, directionsUrl, type MapsProvider } from "@/lib/map/directions";
import type { ListingOut } from "@/components/marketplace/types";

/**
 * Opens directions to the space in the device's own maps app. The first
 * render always uses Google Maps so the prerendered HTML matches on hydrate;
 * Apple devices switch to Apple Maps once mounted.
 */
export default function NavigateButton({ listing, className = "" }: { listing: ListingOut; className?: string }) {
  const [provider, setProvider] = useState<MapsProvider>("google");

  useEffect(() => {
    setProvider(currentMapsProvider());
  }, []);

  const href = directionsUrl(listing, provider);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 border border-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-white ${className}`}
    >
      <Icon name="directions" className="!text-base" />
      Navigate
    </a>
  );
}
