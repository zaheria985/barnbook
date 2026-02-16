"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconWallet,
  IconHorse,
  IconCalendar,
  IconPlus,
  IconMenu,
} from "./icons";
import MobileMoreSheet from "./MobileMoreSheet";

const tabs = [
  { href: "/budget", label: "Budget", icon: IconWallet },
  { href: "/rides", label: "Rides", icon: IconHorse },
  { href: "/calendar", label: "Calendar", icon: IconCalendar },
  { href: "/budget/entry", label: "Entry", icon: IconPlus },
];

export default function BottomTabs() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  if (pathname.startsWith("/auth")) return null;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-xl md:hidden">
        {tabs.map((tab) => {
          const active =
            tab.href === "/budget"
              ? pathname === "/budget"
              : pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                active
                  ? "text-[var(--brand)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <span className="relative">
                {active && (
                  <span className="absolute -top-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--brand)]" />
                )}
                <tab.icon size={22} />
              </span>
              {tab.label}
            </Link>
          );
        })}
        <button
          onClick={() => setShowMore(true)}
          className={`relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
            showMore
              ? "text-[var(--brand)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <span className="relative">
            {showMore && (
              <span className="absolute -top-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--brand)]" />
            )}
            <IconMenu size={22} />
          </span>
          More
        </button>
      </nav>
      <MobileMoreSheet open={showMore} onClose={() => setShowMore(false)} />
    </>
  );
}
