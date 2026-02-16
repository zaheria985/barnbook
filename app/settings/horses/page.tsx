"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import type { Horse } from "@/lib/queries/horses";

export default function HorseProfilesPage() {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null);
  const [formName, setFormName] = useState("");
  const [formWeight, setFormWeight] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchHorses = useCallback(async () => {
    try {
      const res = await fetch("/api/horses");
      if (!res.ok) throw new Error("Failed to fetch");
      setHorses(await res.json());
    } catch {
      setError("Failed to load horses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHorses();
  }, [fetchHorses]);

  function openAdd() {
    setEditingHorse(null);
    setFormName("");
    setFormWeight("");
    setModalOpen(true);
  }

  function openEdit(horse: Horse) {
    setEditingHorse(horse);
    setFormName(horse.name);
    setFormWeight(horse.weight_lbs != null ? String(horse.weight_lbs) : "");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);

    try {
      const body = {
        name: formName.trim(),
        weight_lbs: formWeight ? Number(formWeight) : null,
      };

      const url = editingHorse
        ? `/api/horses/${editingHorse.id}`
        : "/api/horses";
      const method = editingHorse ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save");
      setModalOpen(false);
      await fetchHorses();
    } catch {
      setError("Failed to save horse");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(horse: Horse) {
    if (!confirm(`Delete "${horse.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/horses/${horse.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      await fetchHorses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete horse"
      );
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        Loading horses...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Horse Profiles
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage your horses for ride tracking
          </p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] transition-colors"
        >
          + Add Horse
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

      {horses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--text-muted)]">
            No horses yet. Add a horse to start tracking rides.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {horses.map((horse) => (
            <div
              key={horse.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] px-4 py-3"
            >
              <div>
                <span className="font-medium text-[var(--text-primary)]">
                  {horse.name}
                </span>
                {horse.weight_lbs != null && (
                  <span className="ml-2 text-sm text-[var(--text-muted)]">
                    {horse.weight_lbs} lbs
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(horse)}
                  className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
                  title="Edit"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(horse)}
                  className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors"
                  title="Delete"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
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
        title={editingHorse ? "Edit Horse" : "Add Horse"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Name
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Bella"
              autoFocus
              required
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Weight (lbs)
            </label>
            <input
              type="number"
              value={formWeight}
              onChange={(e) => setFormWeight(e.target.value)}
              placeholder="e.g. 1100"
              step="0.1"
              min="0"
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Used for Mcal calculations
            </p>
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
              {saving ? "Saving..." : editingHorse ? "Update" : "Add Horse"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
