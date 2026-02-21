"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconSliders,
  IconX,
} from "./icons";
import ThemeToggle from "./ThemeToggle";

const settingsItems = [
  { href: "/settings?tab=account", label: "Account", icon: IconSliders },
  { href: "/settings?tab=barn", label: "Barn", icon: IconSliders },
  { href: "/settings?tab=budget", label: "Budget", icon: IconSliders },
  { href: "/settings?tab=system", label: "System", icon: IconSliders },
];

export default function MobileMoreSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--overlay)] animate-fade-in"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[var(--surface)] pb-8 pt-4 shadow-xl animate-slide-up"
      >
        {/* Handle bar */}
        <div className="mb-4 flex items-center justify-between px-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Navigation grid */}
        <div className="grid grid-cols-4 gap-1 px-4">
          {settingsItems.map((item) => {
            const active = pathname === "/settings";
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-colors ${
                  active
                    ? "bg-[var(--interactive-light)] text-[var(--interactive)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                <item.icon size={22} />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Theme toggle */}
        <div className="mt-4 flex items-center justify-between border-t border-[var(--border-light)] px-4 pt-4">
          <span className="text-sm text-[var(--text-secondary)]">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
