"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Modal from "@/components/ui/Modal";

interface VetRecord {
  id: string;
  horse_id: string;
  visit_date: string;
  provider: string | null;
  reason: string | null;
  notes: string | null;
  cost: string | null;
  created_at: string;
  updated_at: string;
}

interface VaccineRecord {
  id: string;
  horse_id: string;
  vaccine_name: string;
  date_administered: string;
  next_due_date: string | null;
  provider: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FarrierRecord {
  id: string;
  horse_id: string;
  visit_date: string;
  provider: string | null;
  service_type: string;
  findings: string | null;
  notes: string | null;
  cost: number | null;
  created_at: string;
  updated_at: string;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  trim: "Trim",
  shoe: "Shoe",
  reset: "Reset",
  other: "Other",
};

function formatCost(cost: string | number | null): string {
  if (cost == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(cost));
}

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

  // Vet records state
  const [vetRecords, setVetRecords] = useState<VetRecord[]>([]);
  const [showVetModal, setShowVetModal] = useState(false);
  const [editingVetId, setEditingVetId] = useState<string | null>(null);
  const [vetDate, setVetDate] = useState(new Date().toISOString().split("T")[0]);
  const [vetProvider, setVetProvider] = useState("");
  const [vetReason, setVetReason] = useState("");
  const [vetNotes, setVetNotes] = useState("");
  const [vetCost, setVetCost] = useState("");
  const [savingVet, setSavingVet] = useState(false);

  // Vaccine records state
  const [vaccines, setVaccines] = useState<VaccineRecord[]>([]);
  const [vaccineModalOpen, setVaccineModalOpen] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<VaccineRecord | null>(null);
  const [vaccineName, setVaccineName] = useState("");
  const [vaccineDateAdministered, setVaccineDateAdministered] = useState(new Date().toISOString().split("T")[0]);
  const [vaccineNextDueDate, setVaccineNextDueDate] = useState("");
  const [vaccineProvider, setVaccineProvider] = useState("");
  const [vaccineNotes, setVaccineNotes] = useState("");
  const [savingVaccine, setSavingVaccine] = useState(false);

  // Farrier records state
  const [farrierRecords, setFarrierRecords] = useState<FarrierRecord[]>([]);
  const [showFarrierModal, setShowFarrierModal] = useState(false);
  const [editingFarrierId, setEditingFarrierId] = useState<string | null>(null);
  const [farrierVisitDate, setFarrierVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [farrierProvider, setFarrierProvider] = useState("");
  const [farrierServiceType, setFarrierServiceType] = useState("trim");
  const [farrierFindings, setFarrierFindings] = useState("");
  const [farrierNotes, setFarrierNotes] = useState("");
  const [farrierCost, setFarrierCost] = useState("");
  const [savingFarrier, setSavingFarrier] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [horsesRes, schedulesRes, barnRes, vetRes, vaccinesRes, farrierRes] = await Promise.all([
        fetch("/api/horses"),
        fetch(`/api/treatments?horse_id=${id}`),
        fetch("/api/treatments"),
        fetch(`/api/horses/${id}/vet-records`),
        fetch(`/api/horses/${id}/vaccines`),
        fetch(`/api/horses/${id}/farrier-records`),
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

      if (vetRes.ok) setVetRecords(await vetRes.json());
      if (vaccinesRes.ok) setVaccines(await vaccinesRes.json());
      if (farrierRes.ok) setFarrierRecords(await farrierRes.json());
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

  // --- Vet record handlers ---
  function resetVetForm() {
    setVetDate(new Date().toISOString().split("T")[0]);
    setVetProvider("");
    setVetReason("");
    setVetNotes("");
    setVetCost("");
    setEditingVetId(null);
    setShowVetModal(false);
  }
  function openAddVet() {
    resetVetForm();
    setShowVetModal(true);
  }
  function openEditVet(r: VetRecord) {
    setEditingVetId(r.id);
    setVetDate(r.visit_date);
    setVetProvider(r.provider || "");
    setVetReason(r.reason || "");
    setVetNotes(r.notes || "");
    setVetCost(r.cost != null ? String(r.cost) : "");
    setShowVetModal(true);
  }
  async function handleVetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingVet(true);
    try {
      const body = {
        visit_date: vetDate,
        provider: vetProvider.trim() || null,
        reason: vetReason.trim() || null,
        notes: vetNotes.trim() || null,
        cost: vetCost ? Number(vetCost) : null,
      };
      const url = editingVetId
        ? `/api/horses/${id}/vet-records/${editingVetId}`
        : `/api/horses/${id}/vet-records`;
      const res = await fetch(url, {
        method: editingVetId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      resetVetForm();
      await fetchData();
    } catch {
      setError("Failed to save vet record");
    } finally {
      setSavingVet(false);
    }
  }
  async function handleDeleteVet(recordId: string) {
    if (!confirm("Delete this vet record?")) return;
    try {
      const res = await fetch(`/api/horses/${id}/vet-records/${recordId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setVetRecords((prev) => prev.filter((r) => r.id !== recordId));
    } catch {
      setError("Failed to delete vet record");
    }
  }

  // --- Vaccine handlers ---
  function resetVaccineForm() {
    setVaccineName("");
    setVaccineDateAdministered(new Date().toISOString().split("T")[0]);
    setVaccineNextDueDate("");
    setVaccineProvider("");
    setVaccineNotes("");
    setEditingVaccine(null);
    setVaccineModalOpen(false);
  }
  function openAddVaccine() {
    resetVaccineForm();
    setVaccineModalOpen(true);
  }
  function openEditVaccine(r: VaccineRecord) {
    setEditingVaccine(r);
    setVaccineName(r.vaccine_name);
    setVaccineDateAdministered(r.date_administered);
    setVaccineNextDueDate(r.next_due_date || "");
    setVaccineProvider(r.provider || "");
    setVaccineNotes(r.notes || "");
    setVaccineModalOpen(true);
  }
  async function handleVaccineSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingVaccine(true);
    try {
      const body = {
        vaccine_name: vaccineName.trim(),
        date_administered: vaccineDateAdministered,
        next_due_date: vaccineNextDueDate || null,
        provider: vaccineProvider.trim() || null,
        notes: vaccineNotes.trim() || null,
      };
      const url = editingVaccine
        ? `/api/horses/${id}/vaccines/${editingVaccine.id}`
        : `/api/horses/${id}/vaccines`;
      const res = await fetch(url, {
        method: editingVaccine ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      resetVaccineForm();
      await fetchData();
    } catch {
      setError("Failed to save vaccine record");
    } finally {
      setSavingVaccine(false);
    }
  }
  async function handleDeleteVaccine(recordId: string) {
    if (!confirm("Delete this vaccine record?")) return;
    try {
      const res = await fetch(`/api/horses/${id}/vaccines/${recordId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setVaccines((prev) => prev.filter((r) => r.id !== recordId));
    } catch {
      setError("Failed to delete vaccine record");
    }
  }

  // --- Farrier record handlers ---
  function resetFarrierForm() {
    setFarrierVisitDate(new Date().toISOString().split("T")[0]);
    setFarrierProvider("");
    setFarrierServiceType("trim");
    setFarrierFindings("");
    setFarrierNotes("");
    setFarrierCost("");
    setEditingFarrierId(null);
    setShowFarrierModal(false);
  }
  function openAddFarrier() {
    resetFarrierForm();
    setShowFarrierModal(true);
  }
  function openEditFarrier(r: FarrierRecord) {
    setEditingFarrierId(r.id);
    setFarrierVisitDate(r.visit_date);
    setFarrierProvider(r.provider || "");
    setFarrierServiceType(r.service_type || "trim");
    setFarrierFindings(r.findings || "");
    setFarrierNotes(r.notes || "");
    setFarrierCost(r.cost != null ? String(r.cost) : "");
    setShowFarrierModal(true);
  }
  async function handleFarrierSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingFarrier(true);
    try {
      const body = {
        visit_date: farrierVisitDate,
        provider: farrierProvider.trim() || null,
        service_type: farrierServiceType,
        findings: farrierFindings.trim() || null,
        notes: farrierNotes.trim() || null,
        cost: farrierCost ? Number(farrierCost) : null,
      };
      const url = editingFarrierId
        ? `/api/horses/${id}/farrier-records/${editingFarrierId}`
        : `/api/horses/${id}/farrier-records`;
      const res = await fetch(url, {
        method: editingFarrierId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      resetFarrierForm();
      await fetchData();
    } catch {
      setError("Failed to save farrier record");
    } finally {
      setSavingFarrier(false);
    }
  }
  async function handleDeleteFarrier(recordId: string) {
    if (!confirm("Delete this farrier record?")) return;
    try {
      const res = await fetch(`/api/horses/${id}/farrier-records/${recordId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setFarrierRecords((prev) => prev.filter((r) => r.id !== recordId));
    } catch {
      setError("Failed to delete farrier record");
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

      {/* Vet Records */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Vet Records</h2>
          <button onClick={openAddVet} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            + Add Record
          </button>
        </div>
        {vetRecords.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
            <p className="text-sm text-[var(--text-muted)]">No vet records yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {vetRecords.map((r) => (
              <div key={r.id} className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{formatDate(r.visit_date)}</span>
                      {r.cost && <span className="text-sm text-[var(--text-muted)]">{formatCost(r.cost)}</span>}
                    </div>
                    {r.provider && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{r.provider}</p>}
                    {r.reason && <p className="mt-1 text-sm text-[var(--text-primary)]">{r.reason}</p>}
                    {r.notes && <p className="mt-1 text-xs text-[var(--text-muted)] line-clamp-2">{r.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => openEditVet(r)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]">Edit</button>
                    <button onClick={() => handleDeleteVet(r.id)} className="text-xs text-[var(--error-text)] hover:underline">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Vaccine History */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Vaccine History</h2>
          <button onClick={openAddVaccine} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            + Add Vaccine
          </button>
        </div>
        {vaccines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
            <p className="text-sm text-[var(--text-muted)]">No vaccine records yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {vaccines.map((r) => {
              const today = new Date().toISOString().split("T")[0];
              const isOverdue = r.next_due_date != null && r.next_due_date < today;
              return (
                <div key={r.id} className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)]">{r.vaccine_name}</span>
                        {isOverdue && (
                          <span className="rounded-full bg-[var(--error-bg)] px-2 py-0.5 text-xs font-medium text-[var(--error-text)]">Overdue</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-[var(--text-muted)]">Given: {formatDate(r.date_administered)}</p>
                      {r.next_due_date && (
                        <p className={`mt-0.5 text-sm ${isOverdue ? "font-medium text-[var(--error-text)]" : "text-[var(--text-muted)]"}`}>
                          Next due: {formatDate(r.next_due_date)}
                        </p>
                      )}
                      {r.provider && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{r.provider}</p>}
                      {r.notes && <p className="mt-1 text-xs text-[var(--text-muted)] line-clamp-2">{r.notes}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button onClick={() => openEditVaccine(r)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]">Edit</button>
                      <button onClick={() => handleDeleteVaccine(r.id)} className="text-xs text-[var(--error-text)] hover:underline">Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Farrier Records */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Farrier Records</h2>
          <button onClick={openAddFarrier} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            + Add Record
          </button>
        </div>
        {farrierRecords.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
            <p className="text-sm text-[var(--text-muted)]">No farrier records yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {farrierRecords.map((r) => (
              <div key={r.id} className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{formatDate(r.visit_date)}</span>
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                        {SERVICE_TYPE_LABELS[r.service_type] || r.service_type}
                      </span>
                      {r.cost != null && <span className="text-sm text-[var(--text-muted)]">{formatCost(r.cost)}</span>}
                    </div>
                    {r.provider && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{r.provider}</p>}
                    {r.findings && <p className="mt-1 text-sm text-[var(--text-primary)]">{r.findings}</p>}
                    {r.notes && <p className="mt-1 text-xs text-[var(--text-muted)] line-clamp-2">{r.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => openEditFarrier(r)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]">Edit</button>
                    <button onClick={() => handleDeleteFarrier(r.id)} className="text-xs text-[var(--error-text)] hover:underline">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Vet Record Modal */}
      <Modal open={showVetModal} onClose={resetVetForm} title={editingVetId ? "Edit Vet Record" : "Add Vet Record"}>
        <form onSubmit={handleVetSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Visit Date</label>
            <input type="date" value={vetDate} onChange={(e) => setVetDate(e.target.value)} required className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Provider</label>
            <input type="text" value={vetProvider} onChange={(e) => setVetProvider(e.target.value)} placeholder="Vet name or clinic" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Reason</label>
            <input type="text" value={vetReason} onChange={(e) => setVetReason(e.target.value)} placeholder="e.g. Annual checkup, lameness" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Cost</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-[var(--text-muted)]">$</span>
              <input type="number" value={vetCost} onChange={(e) => setVetCost(e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notes</label>
            <textarea value={vetNotes} onChange={(e) => setVetNotes(e.target.value)} rows={2} placeholder="Additional details..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={savingVet} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {savingVet ? "Saving..." : editingVetId ? "Update" : "Add Record"}
            </button>
            <button type="button" onClick={resetVetForm} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Vaccine Modal */}
      <Modal open={vaccineModalOpen} onClose={resetVaccineForm} title={editingVaccine ? "Edit Vaccine" : "Add Vaccine"}>
        <form onSubmit={handleVaccineSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Vaccine Name</label>
            <input type="text" value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} required placeholder="e.g. Rabies, West Nile" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Date Administered</label>
              <input type="date" value={vaccineDateAdministered} onChange={(e) => setVaccineDateAdministered(e.target.value)} required className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Next Due Date</label>
              <input type="date" value={vaccineNextDueDate} onChange={(e) => setVaccineNextDueDate(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Provider</label>
            <input type="text" value={vaccineProvider} onChange={(e) => setVaccineProvider(e.target.value)} placeholder="Vet name or clinic" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notes</label>
            <textarea value={vaccineNotes} onChange={(e) => setVaccineNotes(e.target.value)} rows={2} placeholder="Additional details..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={savingVaccine} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {savingVaccine ? "Saving..." : editingVaccine ? "Update" : "Add Vaccine"}
            </button>
            <button type="button" onClick={resetVaccineForm} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Farrier Record Modal */}
      <Modal open={showFarrierModal} onClose={resetFarrierForm} title={editingFarrierId ? "Edit Farrier Record" : "Add Farrier Record"}>
        <form onSubmit={handleFarrierSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Visit Date</label>
            <input type="date" value={farrierVisitDate} onChange={(e) => setFarrierVisitDate(e.target.value)} required className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Provider</label>
            <input type="text" value={farrierProvider} onChange={(e) => setFarrierProvider(e.target.value)} placeholder="Farrier name" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Service Type</label>
            <select value={farrierServiceType} onChange={(e) => setFarrierServiceType(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]">
              <option value="trim">Trim</option>
              <option value="shoe">Shoe</option>
              <option value="reset">Reset</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Findings</label>
            <textarea value={farrierFindings} onChange={(e) => setFarrierFindings(e.target.value)} rows={2} placeholder="Hoof condition, observations..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Cost</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-[var(--text-muted)]">$</span>
              <input type="number" value={farrierCost} onChange={(e) => setFarrierCost(e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notes</label>
            <textarea value={farrierNotes} onChange={(e) => setFarrierNotes(e.target.value)} rows={2} placeholder="Additional details..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={savingFarrier} className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {savingFarrier ? "Saving..." : editingFarrierId ? "Update" : "Add Record"}
            </button>
            <button type="button" onClick={resetFarrierForm} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
