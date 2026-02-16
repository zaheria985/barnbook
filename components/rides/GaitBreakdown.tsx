"use client";

export default function GaitBreakdown({
  walk,
  trot,
  canter,
  total,
}: {
  walk: number;
  trot: number;
  canter: number;
  total: number;
}) {
  if (total === 0) return null;

  const walkPct = (walk / total) * 100;
  const trotPct = (trot / total) * 100;
  const canterPct = (canter / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        {walkPct > 0 && (
          <div
            className="bg-emerald-400 transition-all"
            style={{ width: `${walkPct}%` }}
            title={`Walk: ${walk}min`}
          />
        )}
        {trotPct > 0 && (
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${trotPct}%` }}
            title={`Trot: ${trot}min`}
          />
        )}
        {canterPct > 0 && (
          <div
            className="bg-rose-400 transition-all"
            style={{ width: `${canterPct}%` }}
            title={`Canter: ${canter}min`}
          />
        )}
      </div>
      <div className="flex gap-3 text-xs text-[var(--text-muted)]">
        {walkPct > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Walk {walk}m
          </span>
        )}
        {trotPct > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            Trot {trot}m
          </span>
        )}
        {canterPct > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
            Canter {canter}m
          </span>
        )}
      </div>
    </div>
  );
}
