"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import type { VendorMapping } from "@/lib/queries/vendor-mappings";

interface Category {
  id: string;
  name: string;
}

export default function VendorMappingsPage() {
  const [mappings, setMappings] = useState<VendorMapping[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formPattern, setFormPattern] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [mappingsRes, categoriesRes] = await Promise.all([
        fetch("/api/vendors"),
        fetch("/api/budget/categories"),
      ]);
      if (mappingsRes.ok) setMappings(await mappingsRes.json());
      if (categoriesRes.ok) {
        const cats = await categoriesRes.json();
        setCategories(cats);
        if (cats.length > 0 && !formCategoryId) setFormCategoryId(cats[0].id);
      }
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [formCategoryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openAdd() {
    setEditingId(null);
    setFormPattern("");
    setFormCategoryId(categories[0]?.id || "");
    setModalOpen(true);
  }

  function openEdit(mapping: VendorMapping) {
    setEditingId(mapping.id);
    setFormPattern(mapping.vendor_pattern);
    setFormCategoryId(mapping.category_id);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formPattern.trim() || !formCategoryId) return;
    setSaving(true);

    try {
      const body = {
        vendor_pattern: formPattern.trim(),
        category_id: formCategoryId,
      };

      const url = editingId ? `/api/vendors/${editingId}` : "/api/vendors";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save");
      setModalOpen(false);
      await fetchData();
    } catch {
      setError("Failed to save mapping");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this vendor mapping?")) return;
    try {
      const res = await fetch(`/api/vendors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setMappings((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError("Failed to delete mapping");
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">Loading...</div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Vendor Mappings
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Auto-categorize expenses by vendor name
          </p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] transition-colors"
        >
          + Add Mapping
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {mappings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--text-muted)]">
            No vendor mappings yet. Add a mapping to auto-categorize expenses.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {mappings.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-[var(--border-light)] bg-[var(--surface)] px-4 py-3"
            >
              <div>
                <span className="font-medium text-[var(--text-primary)]">
                  {m.vendor_pattern}
                </span>
                <span className="ml-2 text-sm text-[var(--text-muted)]">
                  &rarr; {m.category_name}
                  {m.sub_item_label && ` / ${m.sub_item_label}`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(m)}
                  className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
                  title="Edit"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors"
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Mapping" : "Add Mapping"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Vendor Pattern
            </label>
            <input
              type="text"
              value={formPattern}
              onChange={(e) => setFormPattern(e.target.value)}
              placeholder="e.g. Tractor Supply"
              required
              autoFocus
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Matched case-insensitively against vendor names
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Category
            </label>
            <select
              value={formCategoryId}
              onChange={(e) => setFormCategoryId(e.target.value)}
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formPattern.trim()}
              className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : editingId ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
