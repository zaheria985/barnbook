/**
 * Loading placeholders matching the app's card idiom
 * (rounded-2xl border-[var(--border-light)] bg-[var(--surface)]).
 *
 * Used by route-level loading.tsx and by pages that fetch client-side.
 */

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--surface-muted)] ${className}`}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-1/3 rounded bg-[var(--surface-muted)]" />
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={`h-3 rounded bg-[var(--surface-muted)] ${i % 2 ? "w-2/3" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Placeholder for a chart card; height matches the charts' 300px plot area. */
export function ChartSkeleton({ title }: { title?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
      {title ? (
        <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
      ) : (
        <div className="mb-4 h-6 w-1/3 animate-pulse rounded bg-[var(--surface-muted)]" />
      )}
      <div className="h-[300px] animate-pulse rounded-xl bg-[var(--surface-muted)]" />
    </div>
  );
}

export default function PageSkeleton({
  rows = 3,
  showHeader = true,
}: {
  rows?: number;
  showHeader?: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      {showHeader && (
        <div className="mb-6 h-8 w-40 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
      )}
      <div className="space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
