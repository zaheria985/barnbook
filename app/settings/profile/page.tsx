"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  weight_lbs: number | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/auth/profile", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load profile");
        }

        if (!cancelled && data) {
          setProfile(data);
          setName(data.name || "");
          setWeight(data.weight_lbs == null ? "" : String(data.weight_lbs));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    if (weight.trim() !== "") {
      const parsed = Number(weight);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError("Weight must be a positive number");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          weight_lbs: weight.trim() === "" ? null : Number(weight),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save");
      }

      setProfile(data);
      setName(data.name || "");
      setWeight(data.weight_lbs == null ? "" : String(data.weight_lbs));
      setSuccess("Saved");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-20 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Profile
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-text)]">
          {success}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-6">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-sm font-medium text-[var(--text-secondary)]"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-[var(--text-secondary)]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={profile?.email || ""}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-[var(--input-border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-muted)]"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Email cannot be changed
              </p>
            </div>

            <div>
              <label
                htmlFor="weight"
                className="mb-1 block text-sm font-medium text-[var(--text-secondary)]"
              >
                Weight (lbs)
                <span className="ml-1 font-normal text-[var(--text-muted)]">
                  — used for ride calorie estimates
                </span>
              </label>
              <input
                id="weight"
                type="number"
                inputMode="numeric"
                min={1}
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
                placeholder="Optional"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
