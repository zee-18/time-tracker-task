interface EntriesErrorProps {
  message: string;
  onRetry: () => void;
}

export function EntriesError({ message, onRetry }: EntriesErrorProps) {
  return (
    <div className="entries-alert" role="alert">
      <span className="entries-error-mark" aria-hidden="true">
        !
      </span>
      <span className="entries-error-text">{message}</span>
      <button
        type="button"
        className="entries-secondary-button"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

interface EntriesEmptyProps {
  message: string;
  hint?: string;
  onNewEntry?: () => void;
}

export function EntriesEmpty({
  message,
  hint,
  onNewEntry,
}: EntriesEmptyProps) {
  return (
    <div className="entries-empty">
      <p>{message}</p>
      {hint !== undefined ? (
        <p className="entries-empty-hint" aria-live="polite">
          {hint}
        </p>
      ) : null}
      {onNewEntry !== undefined ? (
        <button
          type="button"
          className="entries-primary-button"
          onClick={onNewEntry}
        >
          New entry
        </button>
      ) : null}
    </div>
  );
}
