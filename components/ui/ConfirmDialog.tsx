"use client";

import { useCallback, useState } from "react";
import Modal from "./Modal";

export function ConfirmDialog({
  open,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title="Are you sure?">
      <p className="mb-5 text-sm text-[var(--text-secondary)]">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-[var(--error-text)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Async drop-in for window.confirm, styled like the rest of the app.
 *
 *   const { confirm, confirmElement } = useConfirm();
 *   ...
 *   if (!(await confirm("Delete this record?"))) return;
 *   ...
 *   return <div>...{confirmElement}</div>
 */
export function useConfirm() {
  const [state, setState] = useState<{
    message: string;
    confirmLabel?: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (message: string, confirmLabel?: string) =>
      new Promise<boolean>((resolve) => {
        setState({ message, confirmLabel, resolve });
      }),
    []
  );

  const confirmElement = state ? (
    <ConfirmDialog
      open
      message={state.message}
      confirmLabel={state.confirmLabel}
      onConfirm={() => {
        state.resolve(true);
        setState(null);
      }}
      onCancel={() => {
        state.resolve(false);
        setState(null);
      }}
    />
  ) : null;

  return { confirm, confirmElement };
}
