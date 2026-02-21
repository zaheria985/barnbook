"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  IconWallet,
  IconChartLine,
  IconTable,
  IconInbox,
  IconHorse,
  IconCalendar,
  IconSliders,
  IconStore,
  IconLogOut,
  IconReceipt,
} from "@/components/icons";
import ThemeToggle from "@/components/ThemeToggle";

const mainItems = [
  { href: "/budget", label: "Budget", icon: IconWallet },
  { href: "/budget/income", label: "Income", icon: IconChartLine },
  { href: "/budget/expenses", label: "Expenses", icon: IconReceipt },
  { href: "/budget/bulk", label: "Bulk Entry", icon: IconTable },
  { href: "/budget/vendors", label: "Vendors", icon: IconStore },
  { href: "/budget/pending", label: "Pending", icon: IconInbox },
  { href: "/rides", label: "Rides", icon: IconHorse },
  { href: "/calendar", label: "Calendar", icon: IconCalendar },
];

const settingsItems = [
  { href: "/settings", label: "Settings", icon: IconSliders },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (pathname.startsWith("/auth")) return null;

  function isActive(href: string) {
    return href === "/budget"
      ? pathname === "/budget"
      : pathname === href || pathname.startsWith(href + "/");
  }

  function renderNavItem(item: { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
          active
            ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] font-semibold border-l-[3px] border-l-[var(--interactive)] -ml-px"
            : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--app-text)] font-medium"
        }`}
      >
        <item.icon size={18} />
        {item.label}
      </Link>
    );
  }

  return (
    <aside className="hidden md:flex md:w-64 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] sticky top-0 h-screen">
      <header className="flex h-16 items-center gap-2 border-b border-[var(--border)] px-4">
        <IconHorse size={28} className="text-[var(--brand)]" />
        <span className="text-xl font-bold text-[var(--brand)]">Barnbook</span>
      </header>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Main
        </p>
        {mainItems.map(renderNavItem)}

        <p className="px-3 mb-1 mt-5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Settings
        </p>
        {settingsItems.map(renderNavItem)}
      </nav>

      <footer className="border-t border-[var(--border)] p-4">
        {session?.user?.name && (
          <p className="mb-2 truncate px-3 text-sm font-medium text-[var(--text-secondary)]">
            {session.user.name}
          </p>
        )}
        <div className="mb-2 px-3">
          <ThemeToggle />
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          aria-label="Sign out"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--app-text)]"
        >
          <IconLogOut size={18} />
          Sign Out
        </button>
        <p className="mt-2 px-3 text-xs text-[var(--muted-text)]">
          Barnbook v0.1
        </p>
      </footer>
    </aside>
  );
}
