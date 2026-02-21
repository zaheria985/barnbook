"use client";

import { Suspense, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProfileSection from "@/components/settings/ProfileSection";
import HorsesSection from "@/components/settings/HorsesSection";
import WeatherSection from "@/components/settings/WeatherSection";
import KeywordsSection from "@/components/settings/KeywordsSection";
import CategoriesSection from "@/components/settings/CategoriesSection";
import BudgetDefaultsSection from "@/components/settings/BudgetDefaultsSection";
import VendorsSection from "@/components/settings/VendorsSection";
import TagsSection from "@/components/settings/TagsSection";
import TemplatesSection from "@/components/settings/TemplatesSection";
import IntegrationsSection from "@/components/settings/IntegrationsSection";

type TabId = "account" | "barn" | "budget" | "system";

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

const TAB_CONFIG: { id: TabId; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "barn", label: "Barn" },
  { id: "budget", label: "Budget" },
  { id: "system", label: "System" },
];

function AccordionSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[var(--surface-muted)]"
      >
        <span className="text-base font-semibold text-[var(--text-primary)]">
          {title}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-[var(--text-muted)] transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-[var(--border-light)] px-5 py-5">
          {children}
        </div>
      )}
    </div>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab") as TabId | null;
  const activeTab: TabId = TAB_CONFIG.some((t) => t.id === tabParam)
    ? tabParam!
    : "account";

  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const setTab = useCallback(
    (tab: TabId) => {
      router.replace(`/settings?tab=${tab}`, { scroll: false });
      setExpandedSection(null);
    },
    [router]
  );

  const toggleSection = useCallback(
    (sectionId: string) => {
      setExpandedSection((prev) => (prev === sectionId ? null : sectionId));
    },
    []
  );

  const sections: Record<TabId, Section[]> = {
    account: [
      { id: "profile", title: "Profile", content: <ProfileSection /> },
    ],
    barn: [
      { id: "horses", title: "Horses", content: <HorsesSection /> },
      {
        id: "weather",
        title: "Weather & Ride Schedule",
        content: <WeatherSection />,
      },
      {
        id: "keywords",
        title: "Calendar Keywords",
        content: <KeywordsSection />,
      },
    ],
    budget: [
      {
        id: "categories",
        title: "Categories",
        content: <CategoriesSection />,
      },
      {
        id: "budget-defaults",
        title: "Budget Templates",
        content: <BudgetDefaultsSection />,
      },
      { id: "vendors", title: "Vendor Mappings", content: <VendorsSection /> },
      { id: "tags", title: "Tags", content: <TagsSection /> },
    ],
    system: [
      {
        id: "templates",
        title: "Checklist Templates",
        content: <TemplatesSection />,
      },
      {
        id: "integrations",
        title: "Integrations",
        content: <IntegrationsSection />,
      },
    ],
  };

  const currentSections = sections[activeTab];

  return (
    <>
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl bg-[var(--surface-muted)] p-1">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Accordion sections */}
      <div className="space-y-3">
        {currentSections.map((section) => (
          <AccordionSection
            key={section.id}
            title={section.title}
            expanded={
              expandedSection === section.id ||
              currentSections.length === 1
            }
            onToggle={() => toggleSection(section.id)}
          >
            {section.content}
          </AccordionSection>
        ))}
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl pb-20 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Settings
        </h1>
      </div>
      <Suspense
        fallback={
          <div className="py-12 text-center text-[var(--text-muted)]">
            Loading...
          </div>
        }
      >
        <SettingsContent />
      </Suspense>
    </div>
  );
}
