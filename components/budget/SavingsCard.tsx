"use client";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function SavingsCard({ balance }: { balance: number }) {
  const isPositive = balance >= 0;

  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">Horse Savings Account</p>
          <p
            className={`text-3xl font-bold ${
              isPositive ? "text-[var(--success-text)]" : "text-[var(--error-text)]"
            }`}
          >
            {formatCurrency(balance)}
          </p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            isPositive ? "bg-[var(--success-bg)]" : "bg-[var(--error-bg)]"
          }`}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isPositive ? "var(--success-text)" : "var(--error-text)"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v20" />
            <path d="m17 5-5-3-5 3" />
            <path d="m17 19-5 3-5-3" />
          </svg>
        </div>
      </div>
    </div>
  );
}
