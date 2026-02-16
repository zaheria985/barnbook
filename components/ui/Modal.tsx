"use client";
import { useEffect, useRef } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pointerStartedOnBackdropRef = useRef(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  function handlePointerDown(event: React.PointerEvent<HTMLDialogElement>) {
    pointerStartedOnBackdropRef.current = event.target === dialogRef.current;
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDialogElement>) {
    if (
      pointerStartedOnBackdropRef.current &&
      event.target === dialogRef.current
    ) {
      onClose();
    }
    pointerStartedOnBackdropRef.current = false;
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="w-full max-w-lg rounded-xl border border-[var(--border-light)] bg-[var(--surface)] p-0 shadow-xl backdrop:bg-[var(--overlay)]"
    >
      <div className="p-6">
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
