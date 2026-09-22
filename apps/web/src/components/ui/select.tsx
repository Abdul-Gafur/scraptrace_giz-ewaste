import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/** Native select: reliable keyboard, screen-reader and mobile behaviour. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className={cn("relative", className)}>
        <select
          ref={ref}
          className="min-h-touch bg-surface text-foreground disabled:bg-surface-subtle aria-invalid:border-danger aria-invalid:bg-danger-subtle w-full appearance-none rounded-sm border ps-3 pe-10 text-sm disabled:cursor-not-allowed disabled:opacity-70"
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute inset-y-0 end-3 my-auto size-4"
        />
      </div>
    );
  },
);
