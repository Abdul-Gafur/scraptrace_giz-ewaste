import { Check } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> {
  label: ReactNode;
  description?: ReactNode;
}

const rowClass =
  "flex min-h-touch cursor-pointer items-center gap-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50";

export const Checkbox = forwardRef<HTMLInputElement, ChoiceProps>(function Checkbox(
  { label, description, className, ...props },
  ref,
) {
  return (
    <label className={cn(rowClass, className)}>
      <span className="relative grid size-6 shrink-0 place-items-center">
        <input
          ref={ref}
          className="peer border-primary bg-surface absolute inset-0 size-full cursor-[inherit] appearance-none rounded-xs border-2"
          type="checkbox"
          {...props}
        />
        <Check
          aria-hidden="true"
          className="text-primary pointer-events-none size-4 opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
      <span className="text-foreground text-sm">
        {label}
        {description ? (
          <span className="text-muted-foreground block text-xs">{description}</span>
        ) : null}
      </span>
    </label>
  );
});

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface RadioGroupProps {
  legend: string;
  name: string;
  options: readonly RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

/** Native radio group: arrow keys, grouping and selection semantics come from the browser. */
export function RadioGroup({
  legend,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  className,
}: RadioGroupProps) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="text-foreground text-xs font-semibold">{legend}</legend>
      {options.map((option) => (
        <label className={rowClass} key={option.value}>
          <input
            className="border-primary bg-surface checked:bg-primary size-6 shrink-0 cursor-[inherit] appearance-none rounded-full border-2 checked:shadow-[inset_0_0_0_4px_var(--surface)]"
            defaultChecked={defaultValue === undefined ? undefined : defaultValue === option.value}
            {...(value === undefined ? {} : { checked: value === option.value })}
            disabled={option.disabled ?? false}
            name={name}
            onChange={() => onValueChange?.(option.value)}
            type="radio"
            value={option.value}
          />
          <span className="text-foreground text-sm">
            {option.label}
            {option.description ? (
              <span className="text-muted-foreground block text-xs">{option.description}</span>
            ) : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export const Switch = forwardRef<HTMLInputElement, ChoiceProps>(function Switch(
  { label, description, className, ...props },
  ref,
) {
  return (
    <label className={cn(rowClass, "justify-between", className)}>
      <span className="text-foreground text-sm">
        {label}
        {description ? (
          <span className="text-muted-foreground block text-xs">{description}</span>
        ) : null}
      </span>
      <span className="relative inline-block h-7 w-12 shrink-0">
        <input
          ref={ref}
          className="peer bg-border checked:bg-primary absolute inset-0 size-full cursor-[inherit] appearance-none rounded-full"
          role="switch"
          type="checkbox"
          {...props}
        />
        <span className="bg-surface pointer-events-none absolute start-0.5 top-0.5 size-6 rounded-full transition-transform peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
      </span>
    </label>
  );
});
