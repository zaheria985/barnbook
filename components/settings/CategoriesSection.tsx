"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  BudgetCategory,
  SubItem,
} from "@/lib/queries/budget-categories";

export default function CategoriesSection() {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add category state
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // Edit category state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [editCategoryName, setEditCategoryName] = useState("");

  // Add sub-item state
  const [addSubItemCatId, setAddSubItemCatId] = useState<string | null>(null);
  const [newSubItemLabel, setNewSubItemLabel] = useState("");
  const [addingSubItem, setAddingSubItem] = useState(false);

  // Edit sub-item state
  const [editingSubItemId, setEditingSubItemId] = useState<string | null>(null);
  const [editSubItemLabel, setEditSubItemLabel] = useState("");

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/budget/categories");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCategories(data);
    } catch {
      setError("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const res = await fetch("/api/budget/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setNewCategoryName("");
      setShowAddCategory(false);
      await fetchCategories();
    } catch {
      setError("Failed to create category");
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleUpdateCategory(id: string) {
    if (!editCategoryName.trim()) return;
    try {
      const res = await fetch(`/api/budget/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editCategoryName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditingCategoryId(null);
      await fetchCategories();
    } catch {
      setError("Failed to update category");
    }
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/budget/categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      await fetchCategories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete category"
      );
    }
  }

  async function handleReorder(id: string, direction: "up" | "down") {
    const idx = categories.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const currentOrder = categories[idx].sort_order;
    const swapOrder = categories[swapIdx].sort_order;

    try {
      await Promise.all([
        fetch(`/api/budget/categories/${categories[idx].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: swapOrder }),
        }),
        fetch(`/api/budget/categories/${categories[swapIdx].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: currentOrder }),
        }),
      ]);
      await fetchCategories();
    } catch {
      setError("Failed to reorder");
    }
  }

  async function handleAddSubItem(e: React.FormEvent, categoryId: string) {
    e.preventDefault();
    if (!newSubItemLabel.trim()) return;
    setAddingSubItem(true);
    try {
      const res = await fetch(
        `/api/budget/categories/${categoryId}/sub-items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: newSubItemLabel.trim() }),
        }
      );
      if (!res.ok) throw new Error("Failed to create");
      setNewSubItemLabel("");
      setAddSubItemCatId(null);
      await fetchCategories();
    } catch {
      setError("Failed to create sub-item");
    } finally {
      setAddingSubItem(false);
    }
  }

  async function handleUpdateSubItem(categoryId: string, subItemId: string) {
    if (!editSubItemLabel.trim()) return;
    try {
      const res = await fetch(
        `/api/budget/categories/${categoryId}/sub-items/${subItemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: editSubItemLabel.trim() }),
        }
      );
      if (!res.ok) throw new Error("Failed to update");
      setEditingSubItemId(null);
      await fetchCategories();
    } catch {
      setError("Failed to update sub-item");
    }
  }

  async function handleDeleteSubItem(
    categoryId: string,
    subItemId: string,
    label: string
  ) {
    if (!confirm(`Delete sub-item "${label}"?`)) return;
    try {
      const res = await fetch(
        `/api/budget/categories/${categoryId}/sub-items/${subItemId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      await fetchCategories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete sub-item"
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[var(--text-muted)]">Loading categories...</div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          Manage expense categories and sub-items
        </p>
        <button
          onClick={() => {
            setShowAddCategory(true);
            setNewCategoryName("");
          }}
          className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] transition-colors"
        >
          + Add Category
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {showAddCategory && (
        <form
          onSubmit={handleAddCategory}
          className="mb-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4"
        >
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            New Category Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Supplements"
              autoFocus
              className="flex-1 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            />
            <button
              type="submit"
              disabled={addingCategory || !newCategoryName.trim()}
              className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
            >
              {addingCategory ? "Adding..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddCategory(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] overflow-hidden"
          >
            {/* Category row */}
            <div className="flex items-center gap-2 px-4 py-3">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleReorder(cat.id, "up")}
                  disabled={idx === 0}
                  className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move up"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                </button>
                <button
                  onClick={() => handleReorder(cat.id, "down")}
                  disabled={idx === categories.length - 1}
                  className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move down"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
              </div>

              {/* System lock icon */}
              {cat.is_system && (
                <span title="System category" className="text-[var(--text-muted)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
              )}

              {/* Category name (editable) */}
              {editingCategoryId === cat.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="text"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdateCategory(cat.id);
                      if (e.key === "Escape") setEditingCategoryId(null);
                    }}
                    autoFocus
                    className="flex-1 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                  />
                  <button
                    onClick={() => handleUpdateCategory(cat.id)}
                    className="text-sm text-[var(--interactive)] hover:underline"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingCategoryId(null)}
                    className="text-sm text-[var(--text-muted)] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span className="font-medium text-[var(--text-primary)]">
                    {cat.name}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {cat.sub_items.length} sub-item{cat.sub_items.length !== 1 ? "s" : ""}
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
                    className={`ml-auto text-[var(--text-muted)] transition-transform ${expandedId === cat.id ? "rotate-180" : ""}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              )}

              {/* Action buttons */}
              {editingCategoryId !== cat.id && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingCategoryId(cat.id);
                      setEditCategoryName(cat.name);
                    }}
                    className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
                    title="Rename"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                  {!cat.is_system && (
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors"
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Expanded sub-items */}
            {expandedId === cat.id && (
              <div className="border-t border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-3">
                {cat.sub_items.length === 0 && addSubItemCatId !== cat.id && (
                  <p className="mb-2 text-sm text-[var(--text-muted)]">
                    No sub-items yet
                  </p>
                )}

                <div className="space-y-1">
                  {cat.sub_items.map((sub: SubItem) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-[var(--surface-subtle)] transition-colors"
                    >
                      <span className="text-xs text-[var(--text-muted)]">&bull;</span>
                      {editingSubItemId === sub.id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="text"
                            value={editSubItemLabel}
                            onChange={(e) => setEditSubItemLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleUpdateSubItem(cat.id, sub.id);
                              if (e.key === "Escape") setEditingSubItemId(null);
                            }}
                            autoFocus
                            className="flex-1 rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                          />
                          <button
                            onClick={() => handleUpdateSubItem(cat.id, sub.id)}
                            className="text-xs text-[var(--interactive)] hover:underline"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingSubItemId(null)}
                            className="text-xs text-[var(--text-muted)] hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-[var(--text-secondary)]">
                            {sub.label}
                          </span>
                          <button
                            onClick={() => {
                              setEditingSubItemId(sub.id);
                              setEditSubItemLabel(sub.label);
                            }}
                            className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
                            title="Edit"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteSubItem(cat.id, sub.id, sub.label)
                            }
                            className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors"
                            title="Delete"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add sub-item form */}
                {addSubItemCatId === cat.id ? (
                  <form
                    onSubmit={(e) => handleAddSubItem(e, cat.id)}
                    className="mt-2 flex gap-2"
                  >
                    <input
                      type="text"
                      value={newSubItemLabel}
                      onChange={(e) => setNewSubItemLabel(e.target.value)}
                      placeholder="Sub-item label"
                      autoFocus
                      className="flex-1 rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                    />
                    <button
                      type="submit"
                      disabled={addingSubItem || !newSubItemLabel.trim()}
                      className="rounded bg-[var(--interactive)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
                    >
                      {addingSubItem ? "..." : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddSubItemCatId(null);
                        setNewSubItemLabel("");
                      }}
                      className="rounded border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface)] transition-colors"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setAddSubItemCatId(cat.id);
                      setNewSubItemLabel("");
                    }}
                    className="mt-2 text-sm text-[var(--interactive)] hover:underline"
                  >
                    + Add Sub-Item
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
