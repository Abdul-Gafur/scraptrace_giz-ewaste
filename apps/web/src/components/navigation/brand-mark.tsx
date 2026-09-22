import { Recycle } from "lucide-react";

export function BrandMark({ label }: { label: string }) {
  return (
    <span className="text-primary-dark inline-flex items-center gap-2 text-[1.375rem] font-extrabold">
      <span
        aria-hidden="true"
        className="bg-primary-dark text-primary-foreground grid size-8 place-items-center rounded-sm"
      >
        <Recycle className="size-5" />
      </span>
      <span>{label}</span>
    </span>
  );
}
