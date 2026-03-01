"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Horse } from "@/lib/queries/horses";

export default function HorsesPage() {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHorses() {
      try {
        const res = await fetch("/api/horses");
        if (res.ok) setHorses(await res.json());
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchHorses();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        Loading horses...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-20 md:pb-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">
        Horses
      </h1>

      {horses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--text-muted)]">
            No horses yet. Add a horse in{" "}
            <Link href="/settings?tab=barn" className="text-[var(--interactive)] hover:underline">
              Settings
            </Link>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {horses.map((horse) => (
            <Link
              key={horse.id}
              href={`/horses/${horse.id}`}
              className="flex items-center gap-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] px-4 py-4 hover:bg-[var(--surface-muted)] transition-colors"
            >
              {horse.photo_url ? (
                <Image
                  src={horse.photo_url}
                  alt={horse.name}
                  width={48}
                  height={48}
                  className="rounded-full object-cover shrink-0"
                  style={{ width: 48, height: 48 }}
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--text-primary)]">{horse.name}</p>
                <p className="text-sm text-[var(--text-muted)]">
                  {[horse.breed, horse.color, horse.weight_lbs ? `${horse.weight_lbs} lbs` : null]
                    .filter(Boolean)
                    .join(" · ") || "View records"}
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--text-muted)]">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
