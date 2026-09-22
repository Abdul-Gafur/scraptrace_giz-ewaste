import { Link } from "@/i18n/navigation";

export interface BreadcrumbItem {
  label: string;
  /** Locale-less route. The last item is the current page and is never a link. */
  href?: string;
}

export function Breadcrumbs({ label, items }: { label: string; items: readonly BreadcrumbItem[] }) {
  return (
    <nav aria-label={label} className="text-muted-foreground text-xs">
      <ol className="flex flex-wrap items-center gap-x-1.5">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li className="flex items-center gap-x-1.5" key={`${index}-${item.label}`}>
              {item.href && !last ? (
                <Link className="underline-offset-2 hover:underline" href={item.href}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined}>{item.label}</span>
              )}
              {last ? null : <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
