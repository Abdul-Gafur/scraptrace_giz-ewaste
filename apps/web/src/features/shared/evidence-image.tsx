"use client";

import Image from "next/image";

import { cn } from "@/lib/cn";

/**
 * A stored evidence preview.
 *
 * Previews are `data:` URLs held in the device store and already reduced to a bounded size when
 * they were captured, so optimisation is switched off: there is no remote origin to fetch and
 * nothing should be sent to an optimiser. The intrinsic size is the preview's bound; the class
 * names control how it actually displays.
 */
const PREVIEW_EDGE = 320;

export function EvidenceImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <Image
      alt={alt}
      className={cn("h-auto w-full rounded-sm border object-contain", className)}
      height={PREVIEW_EDGE}
      src={src}
      unoptimized
      width={PREVIEW_EDGE}
    />
  );
}
