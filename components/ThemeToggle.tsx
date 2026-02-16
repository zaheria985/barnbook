"use client";

import { useTheme } from "./ThemeProvider";
import { IconSun, IconMoon, IconMonitor } from "./icons";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "light" as const, icon: IconSun, label: "Light" },
    { value: "dark" as const, icon: IconMoon, label: "Dark" },
    { value: "system" as const, icon: IconMonitor, label: "System" },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg bg-[var(--surface-muted)] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          className={`rounded-md p-1.5 transition-colors ${
            theme === opt.value
              ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <opt.icon size={16} />
        </button>
      ))}
    </div>
  );
}
