import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "min-h-11 w-full rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-subtle)] sm:text-sm",
          className,
        )}
        {...props}
      />
    );
  },
);
