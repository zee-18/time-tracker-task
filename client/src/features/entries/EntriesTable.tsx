import { entryKey } from "../../api/entriesQueries";
import type { Entry } from "../../api/types";
import { formatDateTime } from "../../lib/dates";
import {
  getTaskPath,
  useTaskPathsRevision,
} from "../tree/selection";

const COLUMNS = [
  "ID",
  "Task ID",
  "Comment",
  "Start",
  "End",
  "Created At",
] as const;

const SKELETON_ROWS = 6;

interface EntriesTableProps {
  entries: Entry[];
  highlightedKey: string | null;
  onSelectEntry: (entry: Entry) => void;
  busy?: boolean;
  busyLabel?: string;
}

export function EntriesTable({
  entries,
  highlightedKey,
  onSelectEntry,
  busy = false,
  busyLabel = "Loading entries",
}: EntriesTableProps) {
  useTaskPathsRevision();

  return (
    <div
      className="entries-table-scroll"
      aria-busy={busy}
    >
      <table
        className={
          busy ? "entries-table entries-table--busy" : "entries-table"
        }
      >
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const key = entryKey(entry);
            const taskPath = getTaskPath(entry.taskId);
            const hasComment = entry.comment.trim().length > 0;
            const rowClassName =
              key === highlightedKey
                ? "entries-row entries-row--highlighted"
                : "entries-row";

            return (
              <tr
                key={key}
                className={rowClassName}
                onClick={(event) => {
                  event.currentTarget
                    .querySelector<HTMLButtonElement>(".entry-open")
                    ?.focus();
                  onSelectEntry(entry);
                }}
              >
                <td>
                  <button
                    type="button"
                    className="entry-open"
                    aria-label={`Select entry ${entry.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectEntry(entry);
                    }}
                  >
                    {entry.id}
                  </button>
                </td>
                <td>
                  <span className="entry-task-id">
                    #{entry.taskId}
                  </span>
                  {taskPath !== undefined ? (
                    <span
                      className="entry-task-name"
                      title={taskPath.task.name}
                    >
                      {taskPath.task.name}
                    </span>
                  ) : null}
                </td>
                <td>
                  <span
                    className={
                      hasComment
                        ? "entry-comment"
                        : "entry-comment entry-comment--empty"
                    }
                    title={hasComment ? entry.comment : undefined}
                  >
                    {hasComment ? entry.comment : "(no comment)"}
                  </span>
                </td>
                <td>{formatDateTime(entry.start)}</td>
                <td>{formatDateTime(entry.end)}</td>
                <td>{formatDateTime(entry.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {busy ? (
        <div
          className="entries-table-busy"
          role="status"
          aria-live="polite"
        >
          <span className="entries-spinner" aria-hidden="true" />
          {busyLabel}
        </div>
      ) : null}
    </div>
  );
}

export function EntriesTableSkeleton() {
  return (
    <div
      className="entries-table-scroll"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading entries</span>
      <table className="entries-table" aria-hidden="true">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
            <tr key={rowIndex} className="entries-row--skeleton">
              {COLUMNS.map((column, columnIndex) => (
                <td key={column}>
                  <span
                    className="entries-skeleton-bar"
                    style={{
                      width:
                        columnIndex === 2
                          ? "85%"
                          : `${55 + ((rowIndex + columnIndex) % 4) * 10}%`,
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EntriesTable;
