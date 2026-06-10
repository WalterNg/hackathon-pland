"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "../dashboard/material-icon";

type CertifySnapshotDialogProps = {
  open: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (title: string, note: string) => Promise<void>;
};

export function CertifySnapshotDialog({
  open,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: CertifySnapshotDialogProps) {
  const [title, setTitle] = useState("Certified Snapshot");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("Certified Snapshot");
    setNote("");
    setTouched(false);
  }, [open]);

  if (!open) return null;

  const trimmedTitle = title.trim();
  const trimmedNote = note.trim();
  const titleError = touched && !trimmedTitle ? "Title is required." : null;
  const noteError = touched && !trimmedNote ? "Note is required." : null;

  const canSubmit = trimmedTitle.length > 0 && trimmedNote.length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    setTouched(true);
    if (!trimmedTitle || !trimmedNote) return;
    await onSubmit(trimmedTitle, trimmedNote);
  };

  return (
    <div className="modal-backdrop z-90">
      <div className="modal-shell max-w-lg p-4 sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-strong sm:text-xl">New Checkpoint</h2>
            <p className="mt-1 text-sm text-muted">Add a title and note — this will be anchored on-chain.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-button h-10 w-10"
            aria-label="Close certify snapshot dialog"
            disabled={isSubmitting}
          >
            <MaterialIcon name="close" outlined={false} className="text-xl" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="field-label">Title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Breakout confirmed"
              className="field-input"
              maxLength={120}
              autoFocus
            />
            {titleError && <p className="mt-1 text-xs text-danger">{titleError}</p>}
          </div>

          <div>
            <label className="field-label">Note</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Why are you creating this checkpoint?"
              className="field-input min-h-[120px] resize-y"
              maxLength={1000}
            />
            {noteError && <p className="mt-1 text-xs text-danger">{noteError}</p>}
          </div>

          {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-danger">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="ui-button-secondary px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="ui-button-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Anchoring…" : "Anchor Checkpoint"}
          </button>
        </div>
      </div>
    </div>
  );
}
