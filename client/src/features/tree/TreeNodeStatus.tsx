interface TreeErrorMessageProps {
  message: string;
  onRetry: () => void;
  retryLabel: string;
}

interface LoadMoreButtonProps {
  loading: boolean;
  label: string;
  onClick: () => void;
}

export function TreeSkeletonRows() {
  return (
    <div className="tree-skeletons" aria-hidden="true">
      <span className="tree-skeleton" />
      <span className="tree-skeleton" />
      <span className="tree-skeleton" />
    </div>
  );
}

export function TreeEmptyMessage({ children }: { children: string }) {
  return (
    <p className="tree-message tree-message--empty">{children}</p>
  );
}

export function TreeErrorMessage({
  message,
  onRetry,
  retryLabel,
}: TreeErrorMessageProps) {
  return (
    <div className="tree-message tree-message--error" role="alert">
      <span className="tree-error-mark" aria-hidden="true">
        !
      </span>
      <span className="tree-error-text">{message}</span>
      <button
        type="button"
        className="tree-retry"
        onClick={onRetry}
        aria-label={`Retry ${retryLabel}`}
      >
        Retry
      </button>
    </div>
  );
}

export function LoadMoreButton({
  loading,
  label,
  onClick,
}: LoadMoreButtonProps) {
  return (
    <button
      type="button"
      className="tree-loadmore"
      disabled={loading}
      onClick={onClick}
      aria-label={
        loading ? `Loading ${label}` : `Load more ${label}`
      }
    >
      {loading ? "Loading..." : "Load more"}
    </button>
  );
}
