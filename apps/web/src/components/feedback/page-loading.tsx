import { Skeleton } from "@/components/ui/skeleton";

/**
 * Whole-page loading state.
 *
 * It carries a level-one heading for assistive technology, so a page that is still preparing is
 * still a page with a heading rather than an unlabelled set of placeholders.
 */
export function PageLoading({ label }: { label: string }) {
  return (
    <div className="content-container space-y-4 py-8" role="status" aria-label={label}>
      <h1 className="sr-only">{label}</h1>
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
