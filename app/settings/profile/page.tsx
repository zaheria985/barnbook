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
      setSuccess("");

      try {
        const res = await fetch("/api/auth/profile", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as
          | Profile
          | { error?: string }
          | null;

        if (!res.ok) {
          const message =
            data && typeof data === "object" && "error" in data
              ? (data as { error?: string }).error
              : "Failed to load profile";
          throw new Error(message || "Failed to load profile");
        }

        if (!cancelled && data && !("error" in (data as object))) {
          const p = data as Profile;
          setProfile(p);
          setName(p.name || "");
          setWeight(p.weight_lbs == null ? "" : String(p.weight_lbs));
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

      const data = (await res.json().catch(() => null)) as
        | Profile
        | { error?: string }
        | null;

      if (!res.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? (data as { error?: string }).error
            : "Failed to save";
        throw new Error(message || "Failed to save");
      }

      const p = data as Profile;
      setProfile(p);
      setName(p.name || "");
      setWeight(p.weight_lbs == null ? "" : String(p.weight_lbs));
      setSuccess("Saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Profile</h1>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {loading ? (
            <p className="text-sm text-gray-600">Loading...</p>
          ) : error ? (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              {success && (
                <div className="rounded bg-green-50 p-3 text-sm text-green-800">
                  {success}
                </div>
              )}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={profile?.email || ""}
                  disabled
                  className="mt-1 block w-full cursor-not-allowed rounded border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                />
              </div>

              <div>
                <label
                  htmlFor="weight"
                  className="block text-sm font-medium text-gray-700"
                >
                  Weight (lbs)
                </label>
                <input
                  id="weight"
                  name="weight"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </form>
          )}
        </div>

        {!loading && !error && profile && (
          <p className="mt-4 text-xs text-gray-500">User ID: {profile.id}</p>
        )}
      </div>
    </div>
  );
}
