import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Task } from "../../api/types";
import { useAllEntries, useEntriesPage } from "../../api/entriesQueries";
import { formatTimeOfDay, getTimezoneLabel } from "../../lib/dates";
import { useHighlightStore } from "../entries/highlightStore";
import EntryDrawer from "../entry-form/EntryDrawer";
import {
  openCreate,
  openEdit,
} from "../entry-form/drawerStore";
import {
  getSelection,
  getTaskPath,
  useSelection,
} from "../tree/selection";
import { AllEntriesView } from "./AllEntriesView";
import { TaskEntriesView } from "./TaskEntriesView";
import { ENTRIES_PAGE_SIZE } from "./constants";

export function EntriesPanel() {
  const selection = useSelection();
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const pageQuery = useEntriesPage(page, ENTRIES_PAGE_SIZE);
  const allEntriesQuery = useAllEntries({
    enabled: selection.view === "task",
  });
  const highlightedKey = useHighlightStore().highlightedKey;
  const refreshControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      refreshControllerRef.current?.abort();
    };
  }, []);

  const taskSelection =
    selection.view === "task" ? selection : null;
  const loadingAnywhere =
    selection.view === "all"
      ? pageQuery.isFetching
      : allEntriesQuery.isFetching;
  const waitingForInitialLoad =
    selection.view === "all"
      ? pageQuery.isLoading || pageQuery.isFetching
      : allEntriesQuery.isLoading || allEntriesQuery.isFetching;
  const refreshDisabled = loadingAnywhere || waitingForInitialLoad;

  const reloadCurrentView = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: ["entries"],
      refetchType: "active",
    });
  };

  const handleRefresh = (): void => {
    void reloadCurrentView().catch(() => undefined);
  };

  const handleNewEntry = (task: Task): void => {
    const taskPath =
      taskSelection?.task.id === task.id
        ? taskSelection
        : getTaskPath(task.id);

    if (taskPath === undefined) {
      return;
    }

    openCreate(taskPath);
  };

  const handleEntryCreated = (): void => {
    if (getSelection().view === "all") {
      setPage(1);
    }
  };

  return (
    <section
      className="entries-panel"
      aria-labelledby="entries-title"
    >
      <header className="entries-header">
        <div className="entries-heading">
          <h2 id="entries-title" className="entries-title">
            {taskSelection === null ? (
              "All my entries"
            ) : (
              <>
                {taskSelection.client.name} &gt;{" "}
                {taskSelection.project.name} &gt;{" "}
                {taskSelection.task.name}
              </>
            )}
          </h2>

          {taskSelection !== null ? (
            <p className="entries-task-id">
              Task id: {taskSelection.task.id}
            </p>
          ) : null}

          <p className="entries-timezone">{getTimezoneLabel()}</p>
        </div>

        <div className="entries-header-actions">
          {taskSelection !== null ? (
            <button
              type="button"
              className="entries-primary-button"
              onClick={() => {
                handleNewEntry(taskSelection.task);
              }}
            >
              New entry
            </button>
          ) : null}

          <div className="entries-sync">
            <span
              className="entries-sync-label"
              role="status"
              aria-live="polite"
            >
              Last synced{" "}
              {selection.view === "all"
                ? pageQuery.dataUpdatedAt === undefined
                  ? "—"
                  : formatTimeOfDay(pageQuery.dataUpdatedAt)
                : allEntriesQuery.dataUpdatedAt === undefined
                  ? "—"
                  : formatTimeOfDay(allEntriesQuery.dataUpdatedAt)}
            </span>
            <button
              type="button"
              className="entries-secondary-button"
              disabled={refreshDisabled}
              onClick={handleRefresh}
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="entries-content">
        {taskSelection === null ? (
          <AllEntriesView
            page={page}
            highlightedKey={highlightedKey}
            onPageChange={setPage}
            onSelectEntry={openEdit}
          />
        ) : (
          <TaskEntriesView
            task={taskSelection.task}
            highlightedKey={highlightedKey}
            onNewEntry={handleNewEntry}
            onSelectEntry={openEdit}
          />
        )}
      </div>

      <EntryDrawer
        onCreated={handleEntryCreated}
        onReloadList={reloadCurrentView}
      />
    </section>
  );
}

export default EntriesPanel;
