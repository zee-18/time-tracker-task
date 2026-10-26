import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAllEntries } from "../../api/entriesQueries";
import { queryKeys } from "../../api/queryKeys";
import type { Entry, Task } from "../../api/types";
import { formatDuration } from "../../lib/dates";
import { getErrorMessage } from "../../lib/errorMessages";
import { ENTRY_FETCH_CAP } from "../../lib/pagination";
import { EntriesEmpty, EntriesError } from "./EntriesStates";
import { EntriesTable, EntriesTableSkeleton } from "./EntriesTable";

interface TaskEntriesViewProps {
  task: Task;
  highlightedKey: string | null;
  onNewEntry: (task: Task) => void;
  onSelectEntry: (entry: Entry) => void;
}

function sortByStartDescending(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const aStart = Date.parse(a.start);
    const bStart = Date.parse(b.start);
    const aValid = Number.isFinite(aStart);
    const bValid = Number.isFinite(bStart);

    if (aValid && bValid && aStart !== bStart) {
      return bStart - aStart;
    }

    if (aValid !== bValid) {
      return aValid ? -1 : 1;
    }

    const byCreatedAt = b.createdAt.localeCompare(a.createdAt);

    if (byCreatedAt !== 0) {
      return byCreatedAt;
    }

    return b.id - a.id;
  });
}

function entryDurationMs(entry: Entry): number | null {
  const start = Date.parse(entry.start);
  const end = Date.parse(entry.end);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start
  ) {
    return null;
  }

  return end - start;
}

export function TaskEntriesView({
  task,
  highlightedKey,
  onNewEntry,
  onSelectEntry,
}: TaskEntriesViewProps) {
  const queryClient = useQueryClient();
  const allEntries = useAllEntries();
  const entries = allEntries.data?.items ?? [];

  const taskEntries = useMemo(
    () =>
      sortByStartDescending(
        entries.filter((entry) => entry.taskId === task.id),
      ),
    [entries, task.id],
  );

  const totalMs = taskEntries.reduce((total, entry) => {
    const duration = entryDurationMs(entry);

    return duration === null ? total : total + duration;
  }, 0);

  const entryCountLabel =
    taskEntries.length === 1
      ? "1 entry"
      : `${taskEntries.length} entries`;
  const totalLabel = allEntries.data?.truncated
    ? `${formatDuration(totalMs)} in loaded entries`
    : `${formatDuration(totalMs)} total`;

  const retry = (): void => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.entriesAll(),
      refetchType: "active",
    });
  };

  return (
    <div className="entries-view">
      {!allEntries.isLoading && allEntries.data ? (
        <p className="entries-summary" role="status" aria-live="polite">
          {entryCountLabel}, {totalLabel}
        </p>
      ) : null}

      {!allEntries.isLoading && allEntries.data?.truncated ? (
        <p className="entries-notice">
          Showing your latest{" "}
          {ENTRY_FETCH_CAP.toLocaleString("en-US")} entries. Older
          entries are not included.
        </p>
      ) : null}

      {allEntries.error !== null && allEntries.error !== undefined ? (
        <EntriesError
          message={getErrorMessage(allEntries.error)}
          onRetry={retry}
        />
      ) : null}

      {allEntries.isLoading ? (
        <EntriesTableSkeleton />
      ) : null}

      {taskEntries.length > 0 ? (
        <EntriesTable
          entries={taskEntries}
          highlightedKey={highlightedKey}
          onSelectEntry={onSelectEntry}
        />
      ) : null}

      {!allEntries.isLoading &&
      allEntries.error === null &&
      allEntries.error === undefined &&
      taskEntries.length === 0 ? (
        <EntriesEmpty
          message="No entries for this task yet."
          onNewEntry={() => onNewEntry(task)}
        />
      ) : null}
    </div>
  );
}

export default TaskEntriesView;
