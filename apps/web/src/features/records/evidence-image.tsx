"use client";

import { EvidencePlaceholder } from "@/components/ui/evidence-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvidenceImage } from "@/services/queries";

/**
 * A stored photograph, or the neutral frame when this device does not hold it. Evidence lives
 * on the device that captured it until an evidence service exists, so another device sees the
 * placeholder rather than a broken image.
 */
export function EvidenceImage({
  evidenceId,
  label,
  className,
}: {
  evidenceId: string;
  label: string;
  className?: string;
}) {
  const { data, isPending } = useEvidenceImage(evidenceId);
  if (isPending) return <Skeleton className="aspect-[16/9] w-full" />;
  if (!data) return <EvidencePlaceholder {...(className ? { className } : {})} label={label} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a locally stored data URL, never a remote asset
    <img
      alt={label}
      className={`w-full rounded-sm border object-cover ${className ?? "max-h-64"}`}
      src={data}
    />
  );
}
