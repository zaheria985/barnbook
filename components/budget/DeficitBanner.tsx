"use client";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function DeficitBanner({
  amount,
  monthLabel,
}: {
  amount: number;
  monthLabel: string;
}) {
  if (amount <= 0) return null;

  return (
    <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3">
      <div className="flex items-center gap-3">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--warning-text)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        <p className="text-sm font-medium text-[var(--warning-text)]">
          Carried from {monthLabel}: {formatCurrency(-amount)}
        </p>
      </div>
    </div>
  );
}
