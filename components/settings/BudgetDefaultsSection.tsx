"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import type { BudgetCategory } from "@/lib/queries/budget-categories";

interface Template {
  id: string;
  name: string;
  is_default: boolean;
}

interface TemplateItem {
  id: string;
  template_id: string;
  category_id: string;
  category_name: string;
  sub_item_id: string | null;
  sub_item_label: string | null;
  budgeted_amount: number;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function editKey(categoryId: string, subItemId: string | null): string {
  return subItemId ? `${categoryId}:${subItemId}` : categoryId;
}

export default function BudgetDefaultsSection() {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({});

  // Template action modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [modalName, setModalName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/budget/templates");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: Template[] = await res.json();
      setTemplates(data);
      return data;
    } catch {
      setError("Failed to load templates");
      return [];
    }
  }, []);

  const fetchItems = useCallback(async (templateId: string) => {
    try {
      const res = await fetch(`/api/budget/templates/${templateId}/items`);
      if (!res.ok) throw new Error("Failed to fetch");
      setItems(await res.json());
    } catch {
      setError("Failed to load template items");
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/budget/categories");
      if (!res.ok) throw new Error("Failed to fetch");
      setCategories(await res.json());
    } catch {
      setError("Failed to load categories");
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchCategories();
      const tmpl = await fetchTemplates();
      if (tmpl.length > 0) {
        const def = tmpl.find((t) => t.is_default) || tmpl[0];
        setSelectedTemplateId(def.id);
        await fetchItems(def.id);
      }
      setLoading(false);
    }
    init();
  }, [fetchCategories, fetchTemplates, fetchItems]);

  async function selectTemplate(id: string) {
    setSelectedTemplateId(id);
    setPendingEdits({});
    await fetchItems(id);
  }

  function toggleCategory(catId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  function getItemAmount(categoryId: string, subItemId: string | null): number {
    const item = items.find(
      (i) =>
        i.category_id === categoryId &&
        (subItemId ? i.sub_item_id === subItemId : i.sub_item_id === null)
    );
    return item ? Number(item.budgeted_amount) : 0;
  }

  function getEditValue(categoryId: string, subItemId: string | null): string {
    const key = editKey(categoryId, subItemId);
    if (pendingEdits[key] !== undefined) return pendingEdits[key];
    return String(getItemAmount(categoryId, subItemId));
  }

  function setEditField(categoryId: string, subItemId: string | null, value: string) {
    const key = editKey(categoryId, subItemId);
    setPendingEdits((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(categoryId: string, subItemId: string | null) {
    if (!selectedTemplateId) return;
    const key = editKey(categoryId, subItemId);
    const val = getEditValue(categoryId, subItemId);
    const amount = Number(val) || 0;
    const current = getItemAmount(categoryId, subItemId);

    if (amount === current) {
      setPendingEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    try {
      const res = await fetch(`/api/budget/templates/${selectedTemplateId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, subItemId, amount }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setPendingEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await fetchItems(selectedTemplateId);
    } catch {
      setError("Failed to save template item");
    }
  }

  async function handleCreate() {
    if (!modalName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/budget/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modalName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create");
      }
      const tmpl: Template = await res.json();
      setShowCreateModal(false);
      setModalName("");
      await fetchTemplates();
      await selectTemplate(tmpl.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRename() {
    if (!modalName.trim() || !selectedTemplateId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/budget/templates/${selectedTemplateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modalName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to rename");
      setShowRenameModal(false);
      setModalName("");
      await fetchTemplates();
    } catch {
      setError("Failed to rename template");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClone() {
    if (!modalName.trim() || !selectedTemplateId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/budget/templates/${selectedTemplateId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modalName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to clone");
      const tmpl: Template = await res.json();
      setShowCloneModal(false);
      setModalName("");
      await fetchTemplates();
      await selectTemplate(tmpl.id);
    } catch {
      setError("Failed to clone template");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedTemplateId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/budget/templates/${selectedTemplateId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setShowDeleteConfirm(false);
      const remaining = await fetchTemplates();
      if (remaining.length > 0) {
        await selectTemplate(remaining[0].id);
      } else {
        setSelectedTemplateId(null);
        setItems([]);
      }
    } catch {
      setError("Failed to delete template");
    } finally {
      setActionLoading(false);
    }
  }

  const total = categories.reduce((sum, cat) => {
    if (cat.sub_items.length > 0) {
      return sum + cat.sub_items.reduce((s, sub) => s + getItemAmount(cat.id, sub.id), 0);
    }
    return sum + getItemAmount(cat.id, null);
  }, 0);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  function renderAmountInput(categoryId: string, subItemId: string | null) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
          $
        </span>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={getEditValue(categoryId, subItemId)}
          onChange={(e) => setEditField(categoryId, subItemId, e.target.value)}
          onBlur={() => handleSave(categoryId, subItemId)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-28 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-7 pr-3 text-right text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
        />
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Named budget templates you can apply to any month
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-[var(--text-muted)]">Loading...</div>
      ) : (
        <div className="space-y-4">
          {/* Template selector */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Template</span>
              <button
                onClick={() => {
                  setModalName("");
                  setShowCreateModal(true);
                }}
                className="text-xs font-medium text-[var(--interactive)] hover:underline"
              >
                + New Template
              </button>
            </div>

            {templates.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No templates yet. Create one to get started.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t.id)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        t.id === selectedTemplateId
                          ? "bg-[var(--interactive)] text-white"
                          : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
                      }`}
                    >
                      {t.name}
                      {t.is_default && (
                        <span className="ml-1 text-[10px] opacity-75">(default)</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Template actions */}
                {selectedTemplate && (
                  <div className="mt-3 flex gap-3 text-xs">
                    <button
                      onClick={() => {
                        setModalName(selectedTemplate.name);
                        setShowRenameModal(true);
                      }}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        setModalName(`${selectedTemplate.name} (copy)`);
                        setShowCloneModal(true);
                      }}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      Clone
                    </button>
                    {!selectedTemplate.is_default && (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-[var(--error-text)] hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Total */}
          {selectedTemplateId && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text-primary)]">Total</span>
                <span className="text-lg font-bold text-[var(--text-primary)]">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          )}

          {/* Categories */}
          {selectedTemplateId &&
            categories.map((cat) => {
              const isExpanded = expandedCategories.has(cat.id);
              const hasSubItems = cat.sub_items.length > 0;
              const catTotal = hasSubItems
                ? cat.sub_items.reduce((s, sub) => s + getItemAmount(cat.id, sub.id), 0)
                : getItemAmount(cat.id, null);

              return (
                <div
                  key={cat.id}
                  className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--surface-muted)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`text-[var(--text-muted)] transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                      <span className="font-medium text-[var(--text-primary)]">
                        {cat.name}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-secondary)]">
                      {formatCurrency(catTotal)}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[var(--border-light)] px-4 py-3 space-y-3">
                      {hasSubItems ? (
                        cat.sub_items.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2"
                          >
                            <span className="text-sm text-[var(--text-secondary)]">
                              {sub.label}
                            </span>
                            {renderAmountInput(cat.id, sub.id)}
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                          <span className="text-sm text-[var(--text-secondary)]">
                            {cat.name}
                          </span>
                          {renderAmountInput(cat.id, null)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Template">
        <input
          type="text"
          value={modalName}
          onChange={(e) => setModalName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          placeholder="Template name..."
          autoFocus
          className="mb-4 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowCreateModal(false)}
            className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={actionLoading || !modalName.trim()}
            className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50"
          >
            {actionLoading ? "Creating..." : "Create"}
          </button>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal open={showRenameModal} onClose={() => setShowRenameModal(false)} title="Rename Template">
        <input
          type="text"
          value={modalName}
          onChange={(e) => setModalName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
          autoFocus
          className="mb-4 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowRenameModal(false)}
            className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
          <button
            onClick={handleRename}
            disabled={actionLoading || !modalName.trim()}
            className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50"
          >
            {actionLoading ? "Saving..." : "Rename"}
          </button>
        </div>
      </Modal>

      {/* Clone Modal */}
      <Modal open={showCloneModal} onClose={() => setShowCloneModal(false)} title="Clone Template">
        <p className="mb-3 text-sm text-[var(--text-secondary)]">
          Create a copy of &ldquo;{selectedTemplate?.name}&rdquo; with a new name:
        </p>
        <input
          type="text"
          value={modalName}
          onChange={(e) => setModalName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleClone(); }}
          autoFocus
          className="mb-4 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowCloneModal(false)}
            className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
          <button
            onClick={handleClone}
            disabled={actionLoading || !modalName.trim()}
            className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50"
          >
            {actionLoading ? "Cloning..." : "Clone"}
          </button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Template">
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Are you sure you want to delete &ldquo;{selectedTemplate?.name}&rdquo;? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={actionLoading}
            className="rounded-lg bg-[var(--error-text)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {actionLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </>
  );
}
