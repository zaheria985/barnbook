export default function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--border-light)] bg-[var(--surface)] p-6 shadow-sm ${className}`}
    >
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
