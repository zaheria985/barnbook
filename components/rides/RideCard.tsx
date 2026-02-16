"use client";

import GaitBreakdown from "./GaitBreakdown";
import type { RideSession } from "@/lib/queries/rides";

export default function RideCard({
  ride,
  onDelete,
}: {
  ride: RideSession;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-[var(--text-primary)]">
            {ride.horse_name}
          </h3>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {ride.total_duration_minutes}min
            {ride.distance_miles ? ` · ${ride.distance_miles}mi` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[var(--surface-muted)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)]">
            {ride.rider_calories_burned} cal
          </span>
          {onDelete && (
            <button
              onClick={() => onDelete(ride.id)}
              className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors"
              title="Delete ride"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <GaitBreakdown
          walk={ride.walk_minutes}
          trot={ride.trot_minutes}
          canter={ride.canter_minutes}
          total={ride.total_duration_minutes}
        />
      </div>

      {ride.notes && (
        <p className="mt-2 text-xs text-[var(--text-muted)] italic">
          {ride.notes}
        </p>
      )}
    </div>
  );
}
