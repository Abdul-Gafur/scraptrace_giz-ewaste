import { Skeleton } from "@/components/ui/skeleton";

export function PageLoading({ label }: { label: string }) {
  return (
    <div className="content-container space-y-4 py-8" role="status" aria-label={label}>
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-24 w-full" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
