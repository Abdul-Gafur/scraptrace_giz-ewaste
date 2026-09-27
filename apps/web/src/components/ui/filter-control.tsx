import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { Select } from "./select";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterControlProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  /** Accessible name, for example "Material". Shown only to assistive technology. */
  label: string;
  options: readonly FilterOption[];
}

/**
 * Compact labelled filter built on the native select.
 *
 * The name is set with `aria-label` so the control's accessible name is exactly the label, rather
 * than the label followed by every option's text, which is what a wrapping label would produce.
 */
export function FilterControl({ label, options, className, ...props }: FilterControlProps) {
  return (
    <div className={cn("block min-w-36", className)}>
      <Select aria-label={label} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
