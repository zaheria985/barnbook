export default function StatCard({
  label,
  value,
  sublabel,
  color = "primary",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: "primary" | "success" | "warning";
}) {
  const colorClasses = {
    primary: "border-l-[var(--interactive)]",
    success: "border-l-[var(--success-solid)]",
    warning: "border-l-[var(--warning-solid)]",
  };
  return (
    <div
      className={`rounded-xl border border-[var(--border-light)] border-l-4 bg-[var(--surface)] p-6 shadow-sm ${colorClasses[color]}`}
    >
      <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[var(--text-primary)]">
        {value}
      </p>
      {sublabel && (
        <p className="mt-1 text-sm text-gray-400">{sublabel}</p>
      )}
    </div>
  );
}
