"use client";

import { useEffect, useState } from "react";
import ListYourSpaceCta from "@/components/marketplace/ListYourSpaceCta";
import { fetchFacets } from "@/lib/listings-source";

/** Feeds the CTA the live listing count; on any failure it simply shows none. */
export default function LiveListYourSpaceCta() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFacets()
      .then((facets) => {
        if (!cancelled) setTotal(facets.total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <ListYourSpaceCta totalListings={total} />;
}
