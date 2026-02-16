const variants: Record<string, string> = {
  default: "bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
  primary: "bg-[var(--interactive-light)] text-[var(--interactive)]",
  success: "bg-[var(--success-bg)] text-[var(--success-text)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  danger: "bg-[var(--error-bg)] text-[var(--error-text)]",
};

export default function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant] || variants.default}`}
    >
      {children}
    </span>
  );
}
