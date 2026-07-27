import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl py-12">
      <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-8 text-center">
        <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
          Page not found
        </h2>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          That page doesn&apos;t exist — it may have moved.
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-[var(--interactive)] hover:underline"
        >
          Back to the barn
        </Link>
      </div>
    </div>
  );
}
