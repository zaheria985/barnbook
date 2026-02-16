export default function StatCard({
  label,
  value,
  sublabel,
  color = "primary",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: "primary" | "success" | "warning" | "rose" | "blue";
}) {
  const colorClasses = {
    primary: "border-l-[var(--interactive)]",
    success: "border-l-[var(--accent-teal)]",
    warning: "border-l-[var(--accent-amber)]",
    rose: "border-l-[var(--accent-rose)]",
    blue: "border-l-[var(--accent-blue)]",
  };
  return (
    <div
      className={`rounded-2xl border border-[var(--border-light)] border-l-4 bg-[var(--surface)] p-6 shadow-sm ${colorClasses[color]}`}
    >
      <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[var(--text-primary)]">
        {value}
      </p>
      {sublabel && (
        <p className="mt-1 text-sm text-[var(--text-muted)]">{sublabel}</p>
      )}
    </div>
  );
}
