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

/** Compact labelled filter built on the native select. */
export function FilterControl({ label, options, className, ...props }: FilterControlProps) {
  return (
    <label className={cn("block min-w-36", className)}>
      <span className="sr-only">{label}</span>
      <Select {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
