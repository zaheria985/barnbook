"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import type { BudgetCategory } from "@/lib/queries/budget-categories";

interface Tag {
  id: string;
  name: string;
  tag_type: string;
  color: string | null;
  default_category_id: string | null;
  default_category_name: string | null;
  default_sub_item_id: string | null;
  default_sub_item_label: string | null;
}

export default function TagsSection() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "vendor" | "label">("all");

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("label");
  const [formColor, setFormColor] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSubItemId, setFormSubItemId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tagRes, catRes] = await Promise.all([
        fetch("/api/tags"),
        fetch("/api/budget/categories"),
      ]);
      if (tagRes.ok) setTags(await tagRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = filter === "all" ? tags : tags.filter((t) => t.tag_type === filter);
  const vendorCount = tags.filter((t) => t.tag_type === "vendor").length;
  const labelCount = tags.filter((t) => t.tag_type === "label").length;

  const selectedCategory = categories.find((c) => c.id === formCategoryId);

  function openCreate() {
    setEditingTag(null);
    setFormName("");
    setFormType("label");
    setFormColor("");
    setFormCategoryId("");
    setFormSubItemId("");
    setShowModal(true);
  }

  function openEdit(tag: Tag) {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormType(tag.tag_type);
    setFormColor(tag.color || "");
    setFormCategoryId(tag.default_category_id || "");
    setFormSubItemId(tag.default_sub_item_id || "");
    setShowModal(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        tagType: formType,
        color: formColor || null,
        defaultCategoryId: formCategoryId || null,
        defaultSubItemId: formSubItemId || null,
      };

      const url = editingTag ? `/api/tags/${editingTag.id}` : "/api/tags";
      const method = editingTag ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setShowModal(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tag");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchData();
    } catch {
      setError("Failed to delete tag");
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          Vendor tags auto-categorize expenses. Label tags organize anything.
        </p>
        <button
          onClick={openCreate}
          className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)]"
        >
          + New Tag
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        {[
          { key: "all" as const, label: `All (${tags.length})` },
          { key: "vendor" as const, label: `Vendors (${vendorCount})` },
          { key: "label" as const, label: `Labels (${labelCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-[var(--interactive)] text-white"
                : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--text-muted)]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-muted)]">
          No tags yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {tag.color && (
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                <div>
                  <span className="font-medium text-[var(--text-primary)]">{tag.name}</span>
                  <span className="ml-2 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                    {tag.tag_type}
                  </span>
                </div>
                {tag.tag_type === "vendor" && tag.default_category_name && (
                  <span className="text-xs text-[var(--text-muted)]">
                    &rarr; {tag.default_category_name}
                    {tag.default_sub_item_label && ` / ${tag.default_sub_item_label}`}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(tag)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="text-xs text-[var(--error-text)] hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingTag ? "Edit Tag" : "New Tag"}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              autoFocus
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
            />
          </div>

          {!editingTag && (
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Type</label>
              <div className="flex gap-2">
                {["vendor", "label"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormType(type)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      formType === type
                        ? "bg-[var(--interactive)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Color (optional)
            </label>
            <input
              type="color"
              value={formColor || "#6d5acd"}
              onChange={(e) => setFormColor(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded border border-[var(--input-border)]"
            />
            {formColor && (
              <button
                onClick={() => setFormColor("")}
                className="ml-2 text-xs text-[var(--text-muted)] hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {formType === "vendor" && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                  Default Category
                </label>
                <select
                  value={formCategoryId}
                  onChange={(e) => {
                    setFormCategoryId(e.target.value);
                    setFormSubItemId("");
                  }}
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
                >
                  <option value="">None</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              {selectedCategory && selectedCategory.sub_items.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                    Default Sub-Item
                  </label>
                  <select
                    value={formSubItemId}
                    onChange={(e) => setFormSubItemId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
                  >
                    <option value="">None</option>
                    {selectedCategory.sub_items.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setShowModal(false)}
            className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formName.trim()}
            className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50"
          >
            {saving ? "Saving..." : editingTag ? "Update" : "Create"}
          </button>
        </div>
      </Modal>
    </>
  );
}
