import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import {
  clientNodeKey,
  projectNodeKey,
} from "./treeState";
import {
  LoadMoreButton,
  TreeEmptyMessage,
  TreeErrorMessage,
  TreeSkeletonRows,
} from "./TreeNodeStatus";
import { TreeRow } from "./TreeRow";
import {
  buildVisibleTree,
  flattenTree,
  type TreeRow as TreeRowData,
  type VisibleProject,
} from "./treeView";
import { useTreeData } from "./useTreeData";
import {
  selectAll,
  selectTask,
  useSelection,
} from "./selection";

interface TreePanelProps {
  autoFocusSearch?: boolean;
}

export function TreePanel({
  autoFocusSearch = false,
}: TreePanelProps) {
  const searchId = useId();
  const searchHintId = `${searchId}-hint`;
  const {
    state,
    toggleClient,
    toggleProject,
    loadMore,
    retry,
  } = useTreeData();
  const selection = useSelection();
  const [search, setSearch] = useState("");
  const [focusedKey, setFocusedKey] = useState("all");
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const query = search.trim();
  const isSearching = query.length > 0;
  const selectedTaskId =
    selection.view === "task" ? selection.task.id : null;

  const visibleClients = useMemo(
    () => buildVisibleTree(state, search),
    [state, search],
  );

  const visibleRows = useMemo(
    () =>
      flattenTree(visibleClients, state, {
        selectedTaskId,
        isSearching,
      }),
    [visibleClients, state, selectedTaskId, isSearching],
  );

  const rowByKey = useMemo(
    () => new Map(visibleRows.map((row) => [row.key, row])),
    [visibleRows],
  );

  const activeKey = visibleRows.some(
    (row) => row.key === focusedKey,
  )
    ? focusedKey
    : (visibleRows[0]?.key ?? "all");

  const clients = state.clients;

  useEffect(() => {
    if (!autoFocusSearch) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [autoFocusSearch]);

  const registerRef = useCallback(
    (key: string, element: HTMLDivElement | null): void => {
      if (element === null) {
        rowRefs.current.delete(key);
      } else {
        rowRefs.current.set(key, element);
      }
    },
    [],
  );

  const focusRow = (key: string): void => {
    setFocusedKey(key);
    rowRefs.current.get(key)?.focus();
  };

  const activateRow = (row: TreeRowData): void => {
    if (row.kind === "all") {
      selectAll();
      return;
    }

    if (row.kind === "task") {
      selectTask(row.task, row.project, row.client);
      return;
    }

    if (row.kind === "client") {
      toggleClient(row.client, row.expanded);
      return;
    }

    toggleProject(row.project, row.client, row.expanded);
  };

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    row: TreeRowData,
  ): void => {
    const index = visibleRows.findIndex(
      (candidate) => candidate.key === row.key,
    );

    if (index < 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (index < visibleRows.length - 1) {
        focusRow(visibleRows[index + 1].key);
      }

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (index > 0) {
        focusRow(visibleRows[index - 1].key);
      }

      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusRow(visibleRows[0].key);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusRow(visibleRows[visibleRows.length - 1].key);
      return;
    }

    if (event.key === "ArrowRight") {
      if (row.kind !== "client" && row.kind !== "project") {
        return;
      }

      event.preventDefault();

      if (!row.expanded) {
        activateRow(row);
        return;
      }

      const next = visibleRows[index + 1];

      if (next?.parentKey === row.key) {
        focusRow(next.key);
      }

      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();

      if (
        (row.kind === "client" || row.kind === "project") &&
        row.expanded
      ) {
        activateRow(row);
        return;
      }

      if (row.parentKey !== null) {
        focusRow(row.parentKey);
      }

      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateRow(row);
    }
  };

  const renderProject = ({ project, tasks }: VisibleProject) => {
    const projectKey = projectNodeKey(project.id);
    const tasksNode = state.tasks[projectKey];
    const projectRow = rowByKey.get(projectKey);

    if (projectRow?.kind !== "project") {
      return null;
    }

    return (
      <Fragment key={projectKey}>
        <TreeRow
          row={projectRow}
          active={activeKey === projectRow.key}
          loading={tasksNode?.loading === true}
          onActivate={activateRow}
          onFocus={setFocusedKey}
          onKeyDown={handleRowKeyDown}
          registerRef={registerRef}
        />

        {projectRow.expanded ? (
          <div role="group" className="tree-group">
            {tasks.map((task) => {
              const taskRow = rowByKey.get(`task:${task.id}`);

              if (taskRow?.kind !== "task") {
                return null;
              }

              return (
                <TreeRow
                  key={taskRow.key}
                  row={taskRow}
                  active={activeKey === taskRow.key}
                  loading={false}
                  onActivate={activateRow}
                  onFocus={setFocusedKey}
                  onKeyDown={handleRowKeyDown}
                  registerRef={registerRef}
                />
              );
            })}

            {tasksNode?.loading && !tasksNode.loaded ? (
              <TreeSkeletonRows />
            ) : null}

            {tasksNode?.error ? (
              <TreeErrorMessage
                message={tasksNode.error}
                onRetry={() =>
                  retry({
                    level: "tasks",
                    project: projectRow.project,
                    client: projectRow.client,
                  })
                }
                retryLabel={`tasks for ${projectRow.project.name}`}
              />
            ) : null}

            {!isSearching &&
            tasksNode?.loaded &&
            tasksNode.items.length === 0 &&
            !tasksNode.error ? (
              <TreeEmptyMessage>No tasks</TreeEmptyMessage>
            ) : null}

            {tasksNode?.hasNext && !tasksNode.error ? (
              <LoadMoreButton
                loading={tasksNode.loading}
                label={`tasks for ${projectRow.project.name}`}
                onClick={() =>
                  loadMore({
                    level: "tasks",
                    project: projectRow.project,
                    client: projectRow.client,
                  })
                }
              />
            ) : null}
          </div>
        ) : null}
      </Fragment>
    );
  };

  const renderClient = ({
    client,
    projects,
  }: (typeof visibleClients)[number]) => {
    const clientKey = clientNodeKey(client.id);
    const clientRow = rowByKey.get(clientKey);
    const projectsNode = state.projects[clientKey];

    if (clientRow?.kind !== "client") {
      return null;
    }

    return (
      <Fragment key={clientKey}>
        <TreeRow
          row={clientRow}
          active={activeKey === clientRow.key}
          loading={projectsNode?.loading === true}
          onActivate={activateRow}
          onFocus={setFocusedKey}
          onKeyDown={handleRowKeyDown}
          registerRef={registerRef}
        />

        {clientRow.expanded ? (
          <div role="group" className="tree-group">
            {projects.map(renderProject)}

            {projectsNode?.loading && !projectsNode.loaded ? (
              <TreeSkeletonRows />
            ) : null}

            {projectsNode?.error ? (
              <TreeErrorMessage
                message={projectsNode.error}
                onRetry={() =>
                  retry({ level: "projects", client })
                }
                retryLabel={`projects for ${client.name}`}
              />
            ) : null}

            {!isSearching &&
            projectsNode?.loaded &&
            projectsNode.items.length === 0 &&
            !projectsNode.error ? (
              <TreeEmptyMessage>No projects</TreeEmptyMessage>
            ) : null}

            {projectsNode?.hasNext && !projectsNode.error ? (
              <LoadMoreButton
                loading={projectsNode.loading}
                label={`projects for ${client.name}`}
                onClick={() =>
                  loadMore({ level: "projects", client })
                }
              />
            ) : null}
          </div>
        ) : null}
      </Fragment>
    );
  };

  const allRow = visibleRows[0];

  return (
    <section className="tree-panel" aria-label="Task browser">
      <div className="tree-search-area">
        <div className="tree-search-field">
          <label className="sr-only" htmlFor={searchId}>
            Search loaded clients, projects, and tasks
          </label>
          <input
            ref={searchInputRef}
            id={searchId}
            className="tree-search-input"
            type="search"
            value={search}
            placeholder="Search loaded items"
            autoComplete="off"
            aria-describedby={
              isSearching ? searchHintId : undefined
            }
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setSearch("");
              }
            }}
          />
          {search.length > 0 ? (
            <button
              type="button"
              className="tree-search-clear"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                searchInputRef.current?.focus();
              }}
            >
              ×
            </button>
          ) : null}
        </div>

        {isSearching ? (
          <div
            id={searchHintId}
            className="tree-search-hints"
            aria-live="polite"
          >
            <p>Searching loaded items only.</p>

            {clients.hasNext ||
            (clients.loaded && clients.error !== null) ? (
              <div className="tree-search-more">
                <p>Load more clients to search them</p>
                {clients.error ? (
                  <TreeErrorMessage
                    message={clients.error}
                    onRetry={() => retry({ level: "clients" })}
                    retryLabel="clients"
                  />
                ) : (
                  <LoadMoreButton
                    loading={clients.loading}
                    label="clients"
                    onClick={() => loadMore({ level: "clients" })}
                  />
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="tree-scroll">
        <div
          role="tree"
          aria-label="Clients, projects, and tasks"
          className="tree"
        >
          {allRow?.kind === "all" ? (
            <TreeRow
              row={allRow}
              active={activeKey === allRow.key}
              loading={clients.loading}
              onActivate={activateRow}
              onFocus={setFocusedKey}
              onKeyDown={handleRowKeyDown}
              registerRef={registerRef}
            />
          ) : null}

          {clients.loading && !clients.loaded ? (
            <TreeSkeletonRows />
          ) : null}

          {!clients.loaded && clients.error ? (
            <TreeErrorMessage
              message={clients.error}
              onRetry={() => retry({ level: "clients" })}
              retryLabel="clients"
            />
          ) : null}

          {!isSearching &&
          clients.loaded &&
          clients.items.length === 0 &&
          !clients.error ? (
            <TreeEmptyMessage>No clients yet</TreeEmptyMessage>
          ) : null}

          {isSearching &&
          clients.loaded &&
          visibleClients.length === 0 &&
          !clients.loading &&
          !clients.error ? (
            <p
              className="tree-message tree-message--empty"
              role="status"
            >
              No matches in loaded items.
            </p>
          ) : null}

          {visibleClients.map(renderClient)}

          {!isSearching && clients.loaded && clients.error ? (
            <TreeErrorMessage
              message={clients.error}
              onRetry={() => retry({ level: "clients" })}
              retryLabel="clients"
            />
          ) : null}

          {!isSearching &&
          clients.hasNext &&
          !clients.error ? (
            <LoadMoreButton
              loading={clients.loading}
              label="clients"
              onClick={() => loadMore({ level: "clients" })}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default TreePanel;
