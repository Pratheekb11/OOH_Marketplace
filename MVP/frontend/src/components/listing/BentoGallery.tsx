"use client";

import { useState } from "react";
import Image from "next/image";
import Icon from "@/components/ui/Icon";

export interface BentoGalleryProps {
  images: string[];
  title: string;
}

const SLOT_CLASSES = [
  "md:col-span-2 md:row-span-2",
  "md:col-span-2",
  "",
  "",
];

function GallerySlot({
  src,
  title,
  className,
  isBonusSlot = false,
}: {
  src: string | null;
  title: string;
  className: string;
  isBonusSlot?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className={`relative overflow-hidden rounded-xl bg-surface-container-high ${className}`}>
      {showImage ? (
        <Image
          src={src as string}
          alt={title}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="brand-gradient flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-white/90">
          <Icon name={isBonusSlot ? "photo_library" : "image"} className="!text-3xl" />
          <span className="truncate-line-2 text-xs font-bold">
            {isBonusSlot ? "More photos coming soon" : title}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Ported from listing_view.html's 4-tile bento gallery. Only the
 * MG Road Premium Unipole seed listing has extra gallery images beyond its
 * card thumbnail (2 of them — a 3rd rotted and was never downloaded, see
 * build brief); every other listing only has the one marketplace-card
 * image. Both cases degrade the same way: missing/broken slots render a
 * branded placeholder instead of a broken-image glyph.
 */
export function BentoGallery({ images, title }: BentoGalleryProps) {
  const slots: (string | null)[] = [images[0] ?? null, images[1] ?? null, images[2] ?? null, images[3] ?? null];

  return (
    <div className="mb-16 grid h-[600px] grid-cols-1 grid-rows-2 gap-4 md:grid-cols-4">
      {slots.map((src, index) => (
        <GallerySlot
          key={index}
          src={src}
          title={title}
          className={SLOT_CLASSES[index]}
          isBonusSlot={index === slots.length - 1}
        />
      ))}
    </div>
  );
}

export default BentoGallery;
