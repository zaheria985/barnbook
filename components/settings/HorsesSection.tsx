"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Modal from "@/components/ui/Modal";
import type { Horse } from "@/lib/queries/horses";

export default function HorsesSection() {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null);
  const [formName, setFormName] = useState("");
  const [formWeight, setFormWeight] = useState("");
  const [formBreed, setFormBreed] = useState("");
  const [formColor, setFormColor] = useState("");
  const [formDob, setFormDob] = useState("");
  const [formRegNumber, setFormRegNumber] = useState("");
  const [saving, setSaving] = useState(false);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setFormBreed("");
    setFormColor("");
    setFormDob("");
    setFormRegNumber("");
    setPhotoPreview(null);
    setModalOpen(true);
  }

  function openEdit(horse: Horse) {
    setEditingHorse(horse);
    setFormName(horse.name);
    setFormWeight(horse.weight_lbs != null ? String(horse.weight_lbs) : "");
    setFormBreed(horse.breed || "");
    setFormColor(horse.color || "");
    setFormDob(horse.date_of_birth ? horse.date_of_birth.split("T")[0] : "");
    setFormRegNumber(horse.registration_number || "");
    setPhotoPreview(horse.photo_url || null);
    setModalOpen(true);
  }

  async function handlePhotoUpload(file: File) {
    if (!editingHorse) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`/api/horses/${editingHorse.id}/photo`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload photo");
      }
      const { photo_url } = await res.json();
      setPhotoPreview(photo_url);
      setEditingHorse({ ...editingHorse, photo_url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handlePhotoDelete() {
    if (!editingHorse) return;
    setUploadingPhoto(true);
    try {
      const res = await fetch(`/api/horses/${editingHorse.id}/photo`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete photo");
      setPhotoPreview(null);
      setEditingHorse({ ...editingHorse, photo_url: null });
    } catch {
      setError("Failed to delete photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);

    try {
      const body = {
        name: formName.trim(),
        weight_lbs: formWeight ? Number(formWeight) : null,
        breed: formBreed.trim() || null,
        color: formColor.trim() || null,
        date_of_birth: formDob || null,
        registration_number: formRegNumber.trim() || null,
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

  const inputClass =
    "w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]";

  return (
    <>
      <div className="flex justify-end">
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
              <div className="flex items-center gap-3">
                {horse.photo_url && (
                  <Image
                    src={horse.photo_url}
                    alt={horse.name}
                    width={36}
                    height={36}
                    className="rounded-full object-cover"
                    style={{ width: 36, height: 36 }}
                  />
                )}
                <div>
                  <span className="font-medium text-[var(--text-primary)]">
                    {horse.name}
                  </span>
                  {(horse.breed || horse.color) && (
                    <span className="ml-2 text-sm text-[var(--text-muted)]">
                      {[horse.breed, horse.color].filter(Boolean).join(" - ")}
                    </span>
                  )}
                  {horse.weight_lbs != null && (
                    <span className="ml-2 text-sm text-[var(--text-muted)]">
                      {horse.weight_lbs} lbs
                    </span>
                  )}
                </div>
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
          {/* Photo upload - only for existing horses */}
          {editingHorse && (
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Photo
              </label>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <Image
                    src={photoPreview}
                    alt={editingHorse.name}
                    width={64}
                    height={64}
                    className="rounded-full object-cover"
                    style={{ width: 64, height: 64 }}
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-50"
                  >
                    {uploadingPhoto ? "Uploading..." : photoPreview ? "Change Photo" : "Upload Photo"}
                  </button>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handlePhotoDelete}
                      disabled={uploadingPhoto}
                      className="text-xs text-[var(--error-text)] hover:underline disabled:opacity-50"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          )}

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
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Breed
              </label>
              <input
                type="text"
                value={formBreed}
                onChange={(e) => setFormBreed(e.target.value)}
                placeholder="e.g. Thoroughbred"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Color
              </label>
              <input
                type="text"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                placeholder="e.g. Bay"
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Date of Birth
              </label>
              <input
                type="date"
                value={formDob}
                onChange={(e) => setFormDob(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Registration #
              </label>
              <input
                type="text"
                value={formRegNumber}
                onChange={(e) => setFormRegNumber(e.target.value)}
                placeholder="e.g. ABC12345"
                className={inputClass}
              />
            </div>
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
              className={inputClass}
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
    </>
  );
}
