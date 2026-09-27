import { Suspense } from "react";
import LiveListYourSpaceCta from "./LiveListYourSpaceCta";
import MarketplaceBrowser from "./MarketplaceBrowser";
import MarketplaceSkeleton from "./MarketplaceSkeleton";

export const metadata = {
  title: "Marketplace | AdSpace",
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

      <LiveListYourSpaceCta />
    </div>
  );
}
