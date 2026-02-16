"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const navItems = [
  { href: "/budget", label: "Budget", icon: "💰" },
  { href: "/budget/income", label: "Income", icon: "📈" },
  { href: "/budget/bulk", label: "Bulk Entry", icon: "📋" },
  { href: "/settings/categories", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (pathname.startsWith("/auth")) return null;

  return (
    <aside className="hidden md:flex md:w-64 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] sticky top-0 h-screen">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--border)] px-4">
        <span className="text-2xl">🐴</span>
        <span className="text-xl font-bold text-[var(--brand)]">Barnbook</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active =
            item.href === "/budget"
              ? pathname === "/budget"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]"
                  : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--app-text)]"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-4">
        {session?.user?.name && (
          <p className="mb-2 truncate px-3 text-sm font-medium text-[var(--text-secondary)]">
            {session.user.name}
          </p>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          aria-label="Sign out"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--app-text)]"
        >
          Sign Out
        </button>
        <p className="mt-2 px-3 text-xs text-[var(--muted-text)]">
          Barnbook v0.1
        </p>
      </div>
    </aside>
  );
}
