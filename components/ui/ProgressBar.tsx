export default function ProgressBar({
  value,
  max = 100,
  showLabel = true,
}: {
  value: number;
  max?: number;
  showLabel?: boolean;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const barColor =
    pct > 100
      ? "bg-red-500"
      : pct >= 80
        ? "bg-[var(--warning-solid)]"
        : "bg-[var(--success-solid)]";
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-[var(--text-tertiary)]">
          {pct}%
        </span>
      )}
    </div>
  );
}
