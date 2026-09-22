import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { Button, type ButtonProps } from "./button";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Required accessible name. Icon-only controls must never be unlabeled. */
  label: string;
  icon: LucideIcon;
  variant?: ButtonProps["variant"];
  loading?: boolean;
}

export function IconButton({
  label,
  icon: Icon,
  variant = "tertiary",
  className,
  ...props
}: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      className={cn("text-foreground", className)}
      size="icon"
      variant={variant}
      {...props}
    >
      <Icon aria-hidden="true" className="size-6" />
    </Button>
  );
}
