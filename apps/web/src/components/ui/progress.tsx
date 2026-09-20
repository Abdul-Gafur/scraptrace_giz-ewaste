interface ProgressProps {
  label: string;
  value: number;
}

export function Progress({ label, value }: ProgressProps) {
  const boundedValue = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-4 text-sm">
        <span>{label}</span>
        <span>{boundedValue}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-subtle)]">
        <div
          className="h-full rounded-full bg-[var(--color-primary)]"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={boundedValue}
          style={{ inlineSize: `${boundedValue}%` }}
        />
      </div>
    </div>
  );
}
