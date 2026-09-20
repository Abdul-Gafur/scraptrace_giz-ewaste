import { Recycle } from "lucide-react";

export function BrandMark({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold text-[var(--color-primary)]">
      <span className="grid size-9 place-items-center rounded-full bg-[var(--color-primary)] text-white">
        <Recycle aria-hidden="true" className="size-5" />
      </span>
      <span>{label}</span>
    </span>
  );
}
