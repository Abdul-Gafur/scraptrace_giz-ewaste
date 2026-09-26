import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { Spinner } from "./spinner";

const buttonVariants = cva(
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-sm px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-dark",
        secondary: "border bg-surface text-foreground hover:bg-surface-subtle active:bg-border",
        tertiary: "text-primary hover:bg-surface-subtle active:bg-border",
        destructive: "bg-danger text-white hover:brightness-90 active:brightness-75",
        destructiveOutline:
          "border border-danger bg-danger-subtle text-danger hover:brightness-95 active:brightness-90",
      },
      size: {
        default: "min-h-touch",
        large: "min-h-12 px-5 text-base",
        icon: "size-touch p-0",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "default", block: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner, sets `aria-busy` and prevents repeated activation. Keep the label visible. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  block,
  loading = false,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, block }), className)}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export { buttonVariants };
