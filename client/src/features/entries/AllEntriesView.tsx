import { useState } from "react";
import { useEntriesPage } from "../../api/entriesQueries";
import type { Entry } from "../../api/types";
import { getErrorMessage } from "../../lib/errorMessages";
import { EntriesEmpty, EntriesError } from "./EntriesStates";
import { EntriesTable, EntriesTableSkeleton } from "./EntriesTable";
import { ENTRIES_PAGE_SIZE } from "./constants";

interface NavigationError {
  page: number;
  message: string;
}

interface AllEntriesViewProps {
  page: number;
  highlightedKey: string | null;
  onPageChange: (page: number) => void;
  onSelectEntry: (entry: Entry) => void;
}

export function AllEntriesView({
  page,
  highlightedKey,
  onPageChange,
  onSelectEntry,
}: AllEntriesViewProps) {
  const [navigating, setNavigating] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<
    number | null
  >(null);
  const [navigationError, setNavigationError] =
    useState<NavigationError | null>(null);

  const pageQuery = useEntriesPage(page, ENTRIES_PAGE_SIZE);
  const items = pageQuery.data?.items ?? [];
  const hasNext = pageQuery.data?.hasNext ?? false;

  const goToPage = async (targetPage: number): Promise<void> => {
    if (targetPage === page) {
      return;
    }

    setNavigating(true);
    setNavigationTarget(targetPage);
    setNavigationError(null);

    try {
      onPageChange(targetPage);
    } catch {
      setNavigationError({
        page: targetPage,
        message: "Couldn't load that page.",
      });
    } finally {
      setNavigating(false);
      setNavigationTarget(null);
    }
  };

  const currentPageError =
    pageQuery.error === null || pageQuery.error === undefined
      ? null
      : {
          page,
          message: getErrorMessage(pageQuery.error),
        };
  const visibleError = navigationError ?? currentPageError;
  const loading = navigating || pageQuery.isFetching;
  const hasRows = items.length > 0;
  const showSkeleton = pageQuery.isLoading || (navigating && !hasRows);
  const showEmpty = !showSkeleton && !loading && !hasRows && visibleError === null;
  const busyLabel =
    navigationTarget === null
      ? "Loading entries"
      : `Loading page ${navigationTarget}`;

  return (
    <div className="entries-view">
      {visibleError !== null ? (
        <EntriesError
          message={visibleError.message}
          onRetry={() => {
            void goToPage(visibleError.page);
          }}
        />
      ) : null}

      {showSkeleton ? <EntriesTableSkeleton /> : null}

      {!showSkeleton && hasRows ? (
        <EntriesTable
          entries={items}
          highlightedKey={highlightedKey}
          onSelectEntry={onSelectEntry}
          busy={loading}
          busyLabel={busyLabel}
        />
      ) : null}

      {showEmpty ? (
        <EntriesEmpty
          message="No entries yet."
          hint="Select a task on the left to add an entry."
        />
      ) : null}

      <nav className="entries-pagination" aria-label="Entries pages">
        <button
          type="button"
          className="entries-secondary-button"
          disabled={loading || page <= 1}
          onClick={() => {
            void goToPage(page - 1);
          }}
        >
          Prev
        </button>
        <span className="entries-page-label">Page {page}</span>
        <button
          type="button"
          className="entries-secondary-button"
          disabled={loading || !hasNext}
          onClick={() => {
            void goToPage(page + 1);
          }}
        >
          Next
        </button>
      </nav>
    </div>
  );
}

export default AllEntriesView;
