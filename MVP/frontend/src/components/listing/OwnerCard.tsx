"use client";

import Image from "next/image";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

/**
 * Ported from listing_view.html's "Trust Factors" panel. There is no
 * owner-profile endpoint, so this renders the seeded owner avatar plus the
 * prototype's static trust copy rather than inventing an API call.
 */
export function OwnerCard() {
  const { showToast } = useToast();

  return (
    <section className="flex flex-col items-center gap-10 rounded-2xl bg-primary-container p-10 text-on-primary-container md:flex-row">
      <div className="shrink-0">
        <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-surface-container-highest">
          <Image
            src="/images/avatars/listing-view-owner.png"
            alt="Space owner"
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
      <div className="flex-grow text-center md:text-left">
        <h4 className="mb-2 text-xl font-bold text-white">Space Managed by AdSpace Horizon Partner</h4>
        <div className="mb-4 flex flex-wrap justify-center gap-4 md:justify-start">
          <span className="flex items-center gap-1 rounded-full border border-surface-container-highest/30 bg-surface-container-highest/20 px-3 py-1 text-xs">
            <Icon name="verified_user" className="!text-xs" />
            5yr Verified Partner
          </span>
          <span className="flex items-center gap-1 rounded-full border border-surface-container-highest/30 bg-surface-container-highest/20 px-3 py-1 text-xs">
            <Icon name="receipt" className="!text-xs" />
            GST Registered
          </span>
        </div>
        <p className="text-sm leading-relaxed text-on-primary-container">
          This partner holds primary leasing rights across Bengaluru. All bookings via AdSpace
          Horizon include automated GST-ready invoicing.
        </p>
      </div>
      <Button
        variant="primary"
        className="!bg-surface-container-highest !text-primary hover:!bg-white"
        onClick={() =>
          showToast({ tone: "default", title: "Messaging isn't available yet", description: "Reach out via Support in the meantime." })
        }
      >
        Message Owner
      </Button>
    </section>
  );
}

export default OwnerCard;
