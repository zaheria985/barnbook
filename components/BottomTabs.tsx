"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/budget", label: "Budget", icon: "💰" },
  { href: "/budget/income", label: "Income", icon: "📈" },
  { href: "/budget/entry", label: "Entry", icon: "➕" },
  { href: "/settings/categories", label: "Settings", icon: "⚙️" },
];

export default function BottomTabs() {
  const pathname = usePathname();

  if (pathname.startsWith("/auth")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-[var(--border)] bg-[var(--surface)] md:hidden">
      {tabs.map((tab) => {
        const active =
          tab.href === "/budget"
            ? pathname === "/budget"
            : pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
              active
                ? "text-[var(--brand)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
