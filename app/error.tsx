"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl py-12">
      <div className="rounded-2xl border border-[var(--error-border)] bg-[var(--error-bg)] p-6 text-center">
        <h2 className="mb-2 text-lg font-semibold text-[var(--error-text)]">
          Something went wrong
        </h2>
        <p className="mb-4 text-sm text-[var(--error-text)]">
          The page hit an unexpected error. Your data is fine — try again, or
          head back home.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
