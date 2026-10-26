import type {
  FormEvent,
  KeyboardEvent,
  RefObject,
} from "react";
import { formatDuration, getTimezoneLabel } from "../../lib/dates";
import {
  COMMENT_MAX_LENGTH,
  getEntryDurationMs,
  type EntryErrors,
} from "../../lib/entryValidation";
import type { EntryWarning } from "../../lib/entryWarnings";
import type { TaskPath } from "../tree/selection";
import {
  EntryFieldError,
  EntryLockedNotice,
  EntrySaveError,
  type SaveErrorState,
} from "./EntryFormFeedback";

interface EntryFormProps {
  locked: boolean;
  taskId: number | null;
  taskPath: TaskPath | null;
  comment: string;
  start: string;
  end: string;
  errors: EntryErrors;
  warnings: EntryWarning[];
  smartStartHint: boolean;
  saving: boolean;
  saveAction: "save" | "save-another" | null;
  reloading: boolean;
  saveError: SaveErrorState | null;
  saveErrorMode?: "save" | "delete";
  listNote: string | null;
  isCreateMode: boolean;
  commentRef: RefObject<HTMLTextAreaElement | null>;
  saveErrorRef: RefObject<HTMLDivElement | null>;
  startRef: RefObject<HTMLInputElement | null>;
  endRef: RefObject<HTMLInputElement | null>;
  onCommentChange: (value: string) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onCommentBlur: () => void;
  onStartBlur: () => void;
  onEndBlur: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onSaveAsNew: () => void;
  onSaveAndAddAnother: () => void;
  onReloadList: () => void;
  onRemoveFromList?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function taskValueLabel(
  taskId: number | null,
  taskPath: TaskPath | null,
): string {
  if (taskId === null) {
    return "No task selected";
  }

  if (taskPath !== null && taskPath.task.id === taskId) {
    return `${taskPath.client.name} > ${taskPath.project.name} > ${taskPath.task.name}`;
  }

  return `Task #${taskId}`;
}

export function EntryForm({
  locked,
  taskId,
  taskPath,
  comment,
  start,
  end,
  errors,
  warnings,
  smartStartHint,
  saving,
  saveAction,
  reloading,
  saveError,
  saveErrorMode = "save",
  listNote,
  isCreateMode,
  commentRef,
  saveErrorRef,
  startRef,
  endRef,
  onCommentChange,
  onStartChange,
  onEndChange,
  onCommentBlur,
  onStartBlur,
  onEndBlur,
  onCancel,
  onDelete,
  onRetry,
  onSaveAsNew,
  onSaveAndAddAnother,
  onReloadList,
  onRemoveFromList,
  onSubmit,
}: EntryFormProps) {
  const fieldsDisabled = saving || locked;
  const taskError = errors.taskId;
  const commentError = errors.comment;
  const startError = errors.start;
  const endError = errors.end;
  const durationMs = getEntryDurationMs(start, end);
  const durationLabel =
    durationMs === null ? "-" : formatDuration(durationMs);

  const handleCommentKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    if (
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey) &&
      !fieldsDisabled
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form
      className="entry-form"
      aria-busy={saving}
      noValidate
      onSubmit={onSubmit}
    >
      <div className="entry-form-body">
        {saveError !== null ? (
          <EntrySaveError
            ref={saveErrorRef}
            error={saveError}
            busy={saving || reloading}
            mode={saveErrorMode}
            onRetry={onRetry}
            onSaveAsNew={onSaveAsNew}
            onReloadList={onReloadList}
            onRemoveFromList={onRemoveFromList}
          />
        ) : null}

        {listNote !== null ? (
          <p className="entry-form-note" role="status">
            {listNote}
          </p>
        ) : null}

        {locked ? <EntryLockedNotice /> : null}

        <div className="entry-field">
          <span id="entry-task-label" className="entry-field-label">
            Task <span className="entry-required">(required)</span>
          </span>
          <div className="entry-task-row">
            <span
              className={
                taskId === null
                  ? "entry-task-value entry-task-value--empty"
                  : "entry-task-value"
              }
              aria-labelledby="entry-task-label"
            >
              {taskValueLabel(taskId, taskPath)}
            </span>
          </div>
          {taskError !== undefined ? (
            <EntryFieldError id="entry-task-error" message={taskError} />
          ) : null}
        </div>

        <div className="entry-field">
          <div className="entry-label-row">
            <label htmlFor="entry-comment" className="entry-field-label">
              Comment <span className="entry-required">(required)</span>
            </label>
            <span
              className={
                comment.length > COMMENT_MAX_LENGTH
                  ? "entry-counter entry-counter--over"
                  : "entry-counter"
              }
            >
              {comment.length}/{COMMENT_MAX_LENGTH}
            </span>
          </div>
          <textarea
            ref={commentRef}
            id="entry-comment"
            className="entry-textarea"
            rows={5}
            value={comment}
            disabled={fieldsDisabled}
            aria-required="true"
            aria-invalid={commentError !== undefined}
            aria-describedby={
              commentError !== undefined
                ? "entry-comment-error"
                : undefined
            }
            onChange={(event) => onCommentChange(event.target.value)}
            onBlur={onCommentBlur}
            onKeyDown={handleCommentKeyDown}
          />
          {commentError !== undefined ? (
            <EntryFieldError
              id="entry-comment-error"
              message={commentError}
            />
          ) : null}
        </div>

        <div className="entry-date-grid">
          <div className="entry-field">
            <label
              htmlFor="entry-start"
              className="entry-field-label"
            >
              Start <span className="entry-required">(required)</span>
            </label>
            <input
              ref={startRef}
              id="entry-start"
              className="entry-date-input"
              type="datetime-local"
              value={start}
              disabled={fieldsDisabled}
              aria-required="true"
              aria-invalid={startError !== undefined}
              aria-describedby={[
                startError !== undefined ? "entry-start-error" : "",
                "entry-timezone",
              ]
                .filter(Boolean)
                .join(" ")}
              onChange={(event) => onStartChange(event.target.value)}
              onBlur={onStartBlur}
            />
            {smartStartHint ? (
              <p className="entry-smart-start-hint">
                Starts when your last entry ended.
              </p>
            ) : null}
            {startError !== undefined ? (
              <EntryFieldError
                id="entry-start-error"
                message={startError}
              />
            ) : null}
          </div>

          <div className="entry-field">
            <label htmlFor="entry-end" className="entry-field-label">
              End <span className="entry-required">(required)</span>
            </label>
            <input
              ref={endRef}
              id="entry-end"
              className="entry-date-input"
              type="datetime-local"
              value={end}
              disabled={fieldsDisabled}
              aria-required="true"
              aria-invalid={endError !== undefined}
              aria-describedby={[
                endError !== undefined ? "entry-end-error" : "",
                "entry-timezone",
              ]
                .filter(Boolean)
                .join(" ")}
              onChange={(event) => onEndChange(event.target.value)}
              onBlur={onEndBlur}
            />
            {endError !== undefined ? (
              <EntryFieldError
                id="entry-end-error"
                message={endError}
              />
            ) : null}
          </div>
        </div>

        <p id="entry-timezone" className="entry-timezone">
          {getTimezoneLabel()}
        </p>

        <p className="entry-duration" role="status" aria-live="polite">
          Duration: {durationLabel}
        </p>

        {warnings.length > 0 ? (
          <div className="entry-warning-list" role="status" aria-live="polite">
            {warnings.map((warning) => (
              <div
                key={`${warning.code}-${warning.message}`}
                className="entry-warning-item"
              >
                <span className="entry-warning-message">
                  {warning.message}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <footer className="entry-form-footer">
        {locked ? (
          <button
            type="button"
            className="entries-secondary-button"
            disabled={saving}
            onClick={onCancel}
          >
            Close
          </button>
        ) : (
          <>
            {!isCreateMode ? (
              <button
                type="button"
                className="entries-danger-button"
                disabled={saving}
                onClick={onDelete}
              >
                Delete entry
              </button>
            ) : null}
            <button
              type="submit"
              className="entries-primary-button"
              disabled={saving}
            >
              {saving && saveAction === "save" ? "Saving..." : "Save entry"}
            </button>
            {isCreateMode ? (
              <button
                type="button"
                className="entries-secondary-button"
                disabled={saving}
                onClick={onSaveAndAddAnother}
              >
                {saving && saveAction === "save-another"
                  ? "Saving..."
                  : "Save and add another"}
              </button>
            ) : null}
            <button
              type="button"
              className="entries-secondary-button"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </button>
          </>
        )}
      </footer>
    </form>
  );
}

export default EntryForm;
