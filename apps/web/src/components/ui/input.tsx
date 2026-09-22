import { Search } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const controlClass =
  "min-h-touch w-full rounded-sm border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-70 aria-invalid:border-danger aria-invalid:bg-danger-subtle";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlClass, className)} {...props} />;
  },
);

/** Search field. `label` is the accessible name; the icon is decorative. */
export const SearchInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }
>(function SearchInput({ className, label, ...props }, ref) {
  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute inset-y-0 start-3 my-auto size-4"
      />
      <input
        ref={ref}
        aria-label={label}
        className={cn(controlClass, "ps-9")}
        type="search"
        {...props}
      />
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(controlClass, "py-2 leading-6", className)}
      rows={rows}
      {...props}
    />
  );
});
