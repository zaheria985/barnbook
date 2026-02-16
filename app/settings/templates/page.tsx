"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import type { TemplateWithItems } from "@/lib/queries/checklist-templates";

const EVENT_TYPES = [
  { value: "show", label: "Show" },
  { value: "vet", label: "Vet Visit" },
  { value: "farrier", label: "Farrier" },
  { value: "lesson", label: "Lesson" },
  { value: "pony_club", label: "Pony Club" },
  { value: "other", label: "Other" },
];

interface TemplateListItem {
  id: string;
  name: string;
  event_type: string;
}

interface FormItem {
  title: string;
  days_before_event: number;
  sort_order: number;
}

export default function TemplatesSettingsPage() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("show");
  const [formItems, setFormItems] = useState<FormItem[]>([]);
  const [formReminders, setFormReminders] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch");
      setTemplates(await res.json());
    } catch {
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  function openAdd() {
    setEditingId(null);
    setFormName("");
    setFormType("show");
    setFormItems([{ title: "", days_before_event: 0, sort_order: 1 }]);
    setFormReminders([]);
    setModalOpen(true);
  }

  async function openEdit(id: string) {
    try {
      const res = await fetch(`/api/templates/${id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const template: TemplateWithItems = await res.json();
      setEditingId(id);
      setFormName(template.name);
      setFormType(template.event_type);
      setFormItems(
        template.items.map((i) => ({
          title: i.title,
          days_before_event: i.days_before_event,
          sort_order: i.sort_order,
        }))
      );
      setFormReminders(template.reminders.map((r) => r.days_before));
      setModalOpen(true);
    } catch {
      setError("Failed to load template");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);

    try {
      const validItems = formItems.filter((i) => i.title.trim());

      if (editingId) {
        const res = await fetch(`/api/templates/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            event_type: formType,
            items: validItems,
            reminders: formReminders.map((d) => ({ days_before: d })),
          }),
        });
        if (!res.ok) throw new Error("Failed to update");
      } else {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            event_type: formType,
          }),
        });
        if (!res.ok) throw new Error("Failed to create");
        const newTemplate = await res.json();

        // Add items if any
        if (validItems.length > 0) {
          await fetch(`/api/templates/${newTemplate.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: validItems,
              reminders: formReminders.map((d) => ({ days_before: d })),
            }),
          });
        }
      }

      setModalOpen(false);
      await fetchTemplates();
    } catch {
      setError("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchTemplates();
    } catch {
      setError("Failed to delete template");
    }
  }

  function addItem() {
    setFormItems([
      ...formItems,
      { title: "", days_before_event: 0, sort_order: formItems.length + 1 },
    ]);
  }

  function removeItem(index: number) {
    setFormItems(formItems.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: string, value: string | number) {
    setFormItems(
      formItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        Loading templates...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Checklist Templates
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Reusable checklists for event preparation
          </p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] transition-colors"
        >
          + New Template
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--text-muted)]">No templates yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] px-4 py-3"
            >
              <div>
                <span className="font-medium text-[var(--text-primary)]">
                  {t.name}
                </span>
                <span className="ml-2 text-xs text-[var(--text-muted)]">
                  {EVENT_TYPES.find((et) => et.value === t.event_type)?.label || t.event_type}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(t.id)}
                  className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
                  title="Edit"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
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
        title={editingId ? "Edit Template" : "New Template"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Show Prep"
              required
              autoFocus
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Event Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Items</label>
              <button
                type="button"
                onClick={addItem}
                className="text-xs font-medium text-[var(--interactive)] hover:underline"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {formItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateItem(idx, "title", e.target.value)}
                    placeholder="Task title"
                    className="flex-1 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1.5 text-xs text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none"
                  />
                  <input
                    type="number"
                    value={item.days_before_event}
                    onChange={(e) => updateItem(idx, "days_before_event", Number(e.target.value))}
                    min="0"
                    title="Days before event"
                    className="w-16 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1.5 text-xs text-center text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
                  />
                  <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">days before</span>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-[var(--text-muted)] hover:text-[var(--error-text)]"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Reminders */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Reminders (days before)</label>
              <button
                type="button"
                onClick={() => setFormReminders([...formReminders, 1])}
                className="text-xs font-medium text-[var(--interactive)] hover:underline"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formReminders.map((d, idx) => (
                <div key={idx} className="flex items-center gap-1 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1">
                  <input
                    type="number"
                    value={d}
                    onChange={(e) => {
                      const updated = [...formReminders];
                      updated[idx] = Number(e.target.value);
                      setFormReminders(updated);
                    }}
                    min="0"
                    className="w-12 bg-transparent text-xs text-center text-[var(--input-text)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setFormReminders(formReminders.filter((_, i) => i !== idx))}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--error-text)]"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
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
              disabled={saving || !formName.trim()}
              className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
