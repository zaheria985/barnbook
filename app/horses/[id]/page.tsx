"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface TreatmentSchedule {
  id: string;
  name: string;
  horse_id: string | null;
  horse_name: string | null;
  frequency_days: number;
  start_date: string;
  end_date: string | null;
  occurrence_count: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function getNextDueDate(startDate: string, frequencyDays: number): string {
  const start = new Date(startDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start >= today) return startDate;
  const daysSinceStart = Math.floor(
    (today.getTime() - start.getTime()) / 86400000
  );
  const periodsElapsed = Math.floor(daysSinceStart / frequencyDays);
  const nextDate = new Date(start);
  nextDate.setDate(nextDate.getDate() + (periodsElapsed + 1) * frequencyDays);
  return nextDate.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HorseDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [horse, setHorse] = useState<{
    id: string;
    name: string;
    weight_lbs: number | null;
  } | null>(null);
  const [schedules, setSchedules] = useState<TreatmentSchedule[]>([]);
  const [barnSchedules, setBarnSchedules] = useState<TreatmentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formFrequency, setFormFrequency] = useState("");
  const [formStartDate, setFormStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formEndDate, setFormEndDate] = useState("");
  const [formOccurrenceCount, setFormOccurrenceCount] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formHorseId, setFormHorseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [horsesRes, schedulesRes, barnRes] = await Promise.all([
        fetch("/api/horses"),
        fetch(`/api/treatments?horse_id=${id}`),
        fetch("/api/treatments"),
      ]);

      if (!horsesRes.ok) throw new Error("Failed to fetch horses");
      const horses = await horsesRes.json();
      const found = horses.find(
        (h: { id: string }) => h.id === id
      );
      if (!found) {
        setError("Horse not found");
        setLoading(false);
        return;
      }
      setHorse(found);

      if (schedulesRes.ok) {
        setSchedules(await schedulesRes.json());
      }

      if (barnRes.ok) {
        const allSchedules: TreatmentSchedule[] = await barnRes.json();
        setBarnSchedules(allSchedules.filter((s) => s.horse_id === null));
      }
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function resetForm() {
    setFormName("");
    setFormFrequency("");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate("");
    setFormOccurrenceCount("");
    setFormNotes("");
    setFormHorseId(null);
    setEditingId(null);
    setShowForm(false);
  }

  function openAddForm(horseId: string | null) {
    resetForm();
    setFormHorseId(horseId);
    setShowForm(true);
  }

  function openEditForm(schedule: TreatmentSchedule) {
    setEditingId(schedule.id);
    setFormName(schedule.name);
    setFormFrequency(String(schedule.frequency_days));
    setFormStartDate(schedule.start_date);
    setFormEndDate(schedule.end_date || "");
    setFormOccurrenceCount(
      schedule.occurrence_count != null
        ? String(schedule.occurrence_count)
        : ""
    );
    setFormNotes(schedule.notes || "");
    setFormHorseId(schedule.horse_id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formFrequency) return;
    setSaving(true);

    try {
      const body = {
        name: formName.trim(),
        frequency_days: Number(formFrequency),
        start_date: formStartDate,
        end_date: formEndDate || null,
        occurrence_count: formOccurrenceCount
          ? Number(formOccurrenceCount)
          : null,
        notes: formNotes.trim() || null,
        horse_id: formHorseId,
      };

      const url = editingId
        ? `/api/treatments/${editingId}`
        : "/api/treatments";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      resetForm();
      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save treatment"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(scheduleId: string) {
    if (!confirm("Delete this treatment schedule?")) return;
    try {
      const res = await fetch(`/api/treatments/${scheduleId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      setBarnSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    } catch {
      setError("Failed to delete treatment schedule");
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        Loading...
      </div>
    );
  }

  if (!horse) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        Horse not found
      </div>
    );
  }

  const treatmentForm = (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
        {editingId ? "Edit Treatment" : "New Treatment"}
      </h3>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
          Name
        </label>
        <input
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="e.g. Dewormer, Farrier"
          required
          autoFocus
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
          Frequency
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-muted)]">Every</span>
          <input
            type="number"
            value={formFrequency}
            onChange={(e) => setFormFrequency(e.target.value)}
            min="1"
            required
            className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
          />
          <span className="text-sm text-[var(--text-muted)]">days</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
            Start Date
          </label>
          <input
            type="date"
            value={formStartDate}
            onChange={(e) => setFormStartDate(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
            End Date{" "}
            <span className="font-normal text-[var(--text-muted)]">
              (optional)
            </span>
          </label>
          <input
            type="date"
            value={formEndDate}
            onChange={(e) => setFormEndDate(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
          Stop after{" "}
          <span className="font-normal text-[var(--text-muted)]">
            (optional)
          </span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={formOccurrenceCount}
            onChange={(e) => setFormOccurrenceCount(e.target.value)}
            min="1"
            placeholder=""
            className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
          />
          <span className="text-sm text-[var(--text-muted)]">occurrences</span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
          Notes{" "}
          <span className="font-normal text-[var(--text-muted)]">
            (optional)
          </span>
        </label>
        <textarea
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          rows={2}
          placeholder="Any additional details..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || !formName.trim() || !formFrequency}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : editingId
            ? "Update Treatment"
            : "Add Treatment"}
        </button>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  function renderScheduleCard(schedule: TreatmentSchedule) {
    const nextDue = getNextDueDate(schedule.start_date, schedule.frequency_days);
    const today = new Date().toISOString().split("T")[0];
    const isDueToday = nextDue === today;
    const isPastDue = nextDue < today;

    return (
      <div
        key={schedule.id}
        className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-[var(--text-primary)]">
              {schedule.name}
            </h4>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              Every {schedule.frequency_days} day
              {schedule.frequency_days !== 1 ? "s" : ""}
            </p>
            <p
              className={`mt-1 text-sm ${
                isPastDue
                  ? "font-medium text-[var(--error-text)]"
                  : isDueToday
                  ? "font-medium text-[var(--success-text)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {isDueToday
                ? "Due today"
                : isPastDue
                ? `Overdue - was due ${formatDate(nextDue)}`
                : `Next due ${formatDate(nextDue)}`}
            </p>
            {schedule.notes && (
              <p className="mt-1 text-xs text-[var(--text-muted)] line-clamp-2">
                {schedule.notes}
              </p>
            )}
            {schedule.occurrence_count != null && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Stops after {schedule.occurrence_count} occurrence
                {schedule.occurrence_count !== 1 ? "s" : ""}
              </p>
            )}
            {schedule.end_date && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Ends {formatDate(schedule.end_date)}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => openEditForm(schedule)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(schedule.id)}
              className="text-xs text-[var(--error-text)] hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-8">
      {/* Back link */}
      <Link
        href="/settings?tab=barn"
        className="mb-4 inline-block text-sm text-[var(--interactive)] hover:underline"
      >
        &larr; Back to Barn Settings
      </Link>

      {/* Horse header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {horse.name}
        </h1>
        {horse.weight_lbs != null && (
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {horse.weight_lbs} lbs
          </p>
        )}
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

      {/* Treatment Schedules for this horse */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Treatment Schedules
          </h2>
          {!showForm && (
            <button
              onClick={() => openAddForm(id)}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              + Add Treatment
            </button>
          )}
        </div>

        {showForm && formHorseId === id && treatmentForm}

        {schedules.length === 0 && !showForm ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              No treatment schedules yet for {horse.name}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => renderScheduleCard(s))}
          </div>
        )}
      </section>

      {/* Barn-wide Treatments */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Barn-wide Treatments
          </h2>
          {!showForm && (
            <button
              onClick={() => openAddForm(null)}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              + Add Barn Treatment
            </button>
          )}
        </div>

        {showForm && formHorseId === null && treatmentForm}

        {barnSchedules.length === 0 && !showForm ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              No barn-wide treatment schedules yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {barnSchedules.map((s) => renderScheduleCard(s))}
          </div>
        )}
      </section>
    </div>
  );
}
