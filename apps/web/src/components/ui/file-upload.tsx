"use client";

import { ImagePlus } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface FileUploadProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  label: string;
  hint?: string;
  /** Receives the chosen files. Uploading is the caller's responsibility. */
  onFilesSelected?: (files: readonly File[]) => void;
}

/** Image or file chooser. The native input stays focusable; the zone is its visible label. */
export function FileUpload({
  label,
  hint,
  onFilesSelected,
  className,
  accept = "image/*",
  ...props
}: FileUploadProps) {
  const id = useId();
  const [names, setNames] = useState<readonly string[]>([]);
  return (
    <div className={cn("space-y-1", className)}>
      <label
        className="bg-surface text-foreground focus-within:outline-focus flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-dashed p-4 text-center text-sm font-semibold focus-within:outline-[length:var(--focus-ring-width)] focus-within:outline-offset-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
        htmlFor={id}
      >
        <ImagePlus aria-hidden="true" className="text-primary size-6" />
        <span>{label}</span>
        {names.length > 0 ? (
          <span className="text-muted-foreground text-xs font-normal">{names.join(", ")}</span>
        ) : null}
        <input
          accept={accept}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="sr-only"
          id={id}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            setNames(files.map((file) => file.name));
            onFilesSelected?.(files);
          }}
          type="file"
          {...props}
        />
      </label>
      {hint ? (
        <p className="text-muted-foreground text-xs" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
