import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { api } from "../../api";
import { isAbortError } from "../../api/abort";
import type { Client, Project, Task } from "../../api/types";
import { getErrorMessage } from "../../lib/errorMessages";
import {
  fetchPage,
  type PageFetcher,
  type PageResult,
} from "../../lib/pagination";
import { rememberTaskPaths } from "./selection";
import {
  TREE_PAGE_SIZE,
  clientNodeKey,
  createInitialTreeState,
  getTargetNode,
  projectNodeKey,
  targetKey,
  treeReducer,
  type LoadTarget,
} from "./treeState";
import type { TreeState } from "./treeState";

export interface TreeDataApi {
  state: TreeState;
  toggleClient: (client: Client, expanded: boolean) => void;
  toggleProject: (
    project: Project,
    client: Client,
    expanded: boolean,
  ) => void;
  loadMore: (target: LoadTarget) => void;
  retry: (target: LoadTarget) => void;
}

function treeCacheKey(target: LoadTarget, page: number): string[] {
  return [
    "tree",
    String(targetKey(target)),
    "page",
    String(page),
    "size",
    String(TREE_PAGE_SIZE),
  ];
}

function loadWithCache<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  target: LoadTarget,
  page: number,
  force: boolean,
  load: PageFetcher<T>,
): Promise<PageResult<T>> {
  const key = treeCacheKey(target, page);

  if (force) {
    queryClient.removeQueries({ queryKey: key, exact: true });
  }

  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: () => fetchPage(load, { page, pageSize: TREE_PAGE_SIZE }),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useTreeData(): TreeDataApi {
  const [state, dispatch] = useReducer(
    treeReducer,
    undefined,
    createInitialTreeState,
  );
  const stateRef = useRef(state);
  const queryClient = useQueryClient();
  const inFlight = useRef(new Map<string, AbortController>());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const runLoad = useCallback(
    async (target: LoadTarget, force: boolean): Promise<void> => {
      const key = targetKey(target);

      if (inFlight.current.has(key)) {
        return;
      }

      const node = getTargetNode(stateRef.current, target);
      const page = (node?.page ?? 0) + 1;

      if (page > 1 && !node?.hasNext) {
        return;
      }

      const controller = new AbortController();
      inFlight.current.set(key, controller);
      dispatch({ type: "loadStart", target });

      try {
        if (target.level === "clients") {
          const result = await loadWithCache<Client>(
            queryClient,
            target,
            page,
            force,
            (params) => api.clients.list(params, { force }),
          );

          if (controller.signal.aborted) {
            return;
          }

          dispatch({
            type: "loadSuccess",
            level: "clients",
            page,
            items: result.items,
            hasNext: result.hasNext,
          });
          return;
        }

        if (target.level === "projects") {
          const result = await loadWithCache<Project>(
            queryClient,
            target,
            page,
            force,
            (params) =>
              api.projects.listByClient(target.client.id, params, {
                force,
              }),
          );

          if (controller.signal.aborted) {
            return;
          }

          dispatch({
            type: "loadSuccess",
            level: "projects",
            client: target.client,
            page,
            items: result.items,
            hasNext: result.hasNext,
          });
          return;
        }

        const result = await loadWithCache<Task>(
          queryClient,
          target,
          page,
          force,
          (params) =>
            api.tasks.listByProject(target.project.id, params, {
              force,
            }),
        );

        if (controller.signal.aborted) {
          return;
        }

        rememberTaskPaths(result.items, target.project, target.client);
        dispatch({
          type: "loadSuccess",
          level: "tasks",
          project: target.project,
          client: target.client,
          page,
          items: result.items,
          hasNext: result.hasNext,
        });
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return;
        }

        dispatch({
          type: "loadError",
          target,
          error: getErrorMessage(error),
        });
      } finally {
        if (inFlight.current.get(key) === controller) {
          inFlight.current.delete(key);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const requests = inFlight.current;
    void runLoad({ level: "clients" }, false);

    return () => {
      for (const controller of requests.values()) {
        controller.abort();
      }

      requests.clear();
    };
  }, [runLoad]);

  const ensureProjects = useCallback(
    (client: Client): void => {
      const node = stateRef.current.projects[clientNodeKey(client.id)];

      if (
        node !== undefined &&
        (node.loaded || node.page > 0 || node.error !== null)
      ) {
        return;
      }

      void runLoad({ level: "projects", client }, false);
    },
    [runLoad],
  );

  const ensureTasks = useCallback(
    (project: Project, client: Client): void => {
      const node = stateRef.current.tasks[projectNodeKey(project.id)];

      if (
        node !== undefined &&
        (node.loaded || node.page > 0 || node.error !== null)
      ) {
        return;
      }

      void runLoad({ level: "tasks", project, client }, false);
    },
    [runLoad],
  );

  const toggleClient = useCallback(
    (client: Client, expanded: boolean): void => {
      dispatch({
        type: "setExpanded",
        key: clientNodeKey(client.id),
        expanded: !expanded,
      });

      if (!expanded) {
        ensureProjects(client);
      }
    },
    [ensureProjects],
  );

  const toggleProject = useCallback(
    (project: Project, client: Client, expanded: boolean): void => {
      dispatch({
        type: "setExpanded",
        key: projectNodeKey(project.id),
        expanded: !expanded,
      });

      if (!expanded) {
        ensureTasks(project, client);
      }
    },
    [ensureTasks],
  );

  const loadMore = useCallback(
    (target: LoadTarget): void => {
      void runLoad(target, false);
    },
    [runLoad],
  );

  const retry = useCallback(
    (target: LoadTarget): void => {
      void runLoad(target, true);
    },
    [runLoad],
  );

  return {
    state,
    toggleClient,
    toggleProject,
    loadMore,
    retry,
  };
}
