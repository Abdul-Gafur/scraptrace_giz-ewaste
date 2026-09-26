import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface FieldControlProps {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  "aria-required": true | undefined;
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | undefined;
  required?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Label, control, hint and validation error wired together with stable ids. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-foreground text-xs font-semibold" htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {hint ? (
        <p className="text-muted-foreground text-xs" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p className="text-danger text-xs font-semibold" id={id} role="alert">
      {children}
    </p>
  );
}

export function HintText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p className="text-muted-foreground text-xs" id={id}>
      {children}
    </p>
  );
}

/** Form-level error summary. Announced assertively when it appears. */
export function FormError({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-danger bg-danger-subtle text-danger rounded-sm border p-3" role="alert">
      <p className="text-sm font-bold">{title}</p>
      {children ? <div className="text-muted-foreground mt-1 text-xs">{children}</div> : null}
    </div>
  );
}
