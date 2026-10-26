import { forwardRef } from "react";

interface EntryFieldErrorProps {
  id: string;
  message: string;
}

export function EntryFieldError({ id, message }: EntryFieldErrorProps) {
  return (
    <p id={id} className="entry-field-error">
      <span className="entry-field-error-icon" aria-hidden="true">
        !
      </span>
      {message}
    </p>
  );
}

export function EntryLockedNotice() {
  return (
    <div className="entry-locked-notice" role="note">
      <span className="entry-notice-icon" aria-hidden="true">
        !
      </span>
      This entry can&apos;t be changed because of a known API issue.
    </div>
  );
}

export type SaveErrorKind =
  | "bad-request"
  | "task-not-found"
  | "entry-not-found"
  | "network"
  | "rate-limited"
  | "generic";

export interface SaveErrorState {
  kind: SaveErrorKind;
  message: string;
}

interface EntrySaveErrorProps {
  error: SaveErrorState;
  busy: boolean;
  mode?: "save" | "delete";
  onRetry: () => void;
  onSaveAsNew?: () => void;
  onReloadList: () => void;
  onRemoveFromList?: () => void;
}

export const EntrySaveError = forwardRef<
  HTMLDivElement,
  EntrySaveErrorProps
>(function EntrySaveError(
  {
    error,
    busy,
    mode = "save",
    onRetry,
    onSaveAsNew,
    onReloadList,
    onRemoveFromList,
  },
  ref,
) {
  const showRetry =
    error.kind === "network" || error.kind === "rate-limited";
  const isDeleteNotFound =
    mode === "delete" && error.kind === "entry-not-found";

  return (
    <div ref={ref} className="entry-save-error" role="alert" tabIndex={-1}>
      <span className="entry-save-error-icon" aria-hidden="true">
        !
      </span>
      <div className="entry-save-error-content">
        <p>{error.message}</p>

        {showRetry ? (
          <button
            type="button"
            className="entries-secondary-button"
            disabled={busy}
            onClick={onRetry}
          >
            Try again
          </button>
        ) : null}

        {mode === "save" && error.kind === "entry-not-found" ? (
          <div className="entry-save-error-actions">
            <button
              type="button"
              className="entries-primary-button"
              disabled={busy}
              onClick={onSaveAsNew}
            >
              Save as a new entry
            </button>
            <button
              type="button"
              className="entries-secondary-button"
              disabled={busy}
              onClick={onReloadList}
            >
              Reload list
            </button>
          </div>
        ) : null}

        {isDeleteNotFound ? (
          <div className="entry-save-error-actions">
            <button
              type="button"
              className="entries-primary-button"
              disabled={busy}
              onClick={onRemoveFromList}
            >
              Remove from list
            </button>
            <button
              type="button"
              className="entries-secondary-button"
              disabled={busy}
              onClick={onReloadList}
            >
              Reload list
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
});

interface ConfirmDialogProps {
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  title,
  confirmLabel,
  cancelLabel,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <div className="entry-discard" role="alertdialog" aria-labelledby="entry-discard-title">
      <p id="entry-discard-title">{title}</p>
      <div className="entry-discard-actions">
        <button
          type="button"
          className="entries-secondary-button"
          autoFocus
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className="entries-danger-button"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

interface DiscardConfirmProps {
  onKeepEditing: () => void;
  onDiscard: () => void;
}

export function DiscardConfirm({
  onKeepEditing,
  onDiscard,
}: DiscardConfirmProps) {
  return (
    <ConfirmDialog
      title="Discard your changes?"
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      onCancel={onKeepEditing}
      onConfirm={onDiscard}
    />
  );
}

interface DeleteConfirmProps {
  entryId: number;
  onKeepEntry: () => void;
  onDeleteEntry: () => void;
}

export function DeleteConfirm({
  entryId,
  onKeepEntry,
  onDeleteEntry,
}: DeleteConfirmProps) {
  return (
    <ConfirmDialog
      title={`Delete entry #${entryId}? This can't be undone.`}
      confirmLabel="Delete entry"
      cancelLabel="Keep entry"
      onCancel={onKeepEntry}
      onConfirm={onDeleteEntry}
    />
  );
}
