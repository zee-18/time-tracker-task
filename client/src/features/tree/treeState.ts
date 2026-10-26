import type { Client, Project, Task } from "../../api/types";

export const TREE_PAGE_SIZE = 25;

export interface TreeNode<T> {
  items: T[];
  page: number;
  hasNext: boolean;
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

export interface TreeState {
  clients: TreeNode<Client>;
  projects: Record<string, TreeNode<Project>>;
  tasks: Record<string, TreeNode<Task>>;
  expanded: Record<string, boolean>;
}

export type LoadTarget =
  | { level: "clients" }
  | { level: "projects"; client: Client }
  | { level: "tasks"; project: Project; client: Client };

export type TreeAction =
  | { type: "loadStart"; target: LoadTarget }
  | {
      type: "loadSuccess";
      level: "clients";
      page: number;
      items: Client[];
      hasNext: boolean;
    }
  | {
      type: "loadSuccess";
      level: "projects";
      client: Client;
      page: number;
      items: Project[];
      hasNext: boolean;
    }
  | {
      type: "loadSuccess";
      level: "tasks";
      project: Project;
      client: Client;
      page: number;
      items: Task[];
      hasNext: boolean;
    }
  | { type: "loadError"; target: LoadTarget; error: string }
  | { type: "setExpanded"; key: string; expanded: boolean };

export function clientNodeKey(clientId: number): string {
  return `client:${clientId}`;
}

export function projectNodeKey(projectId: number): string {
  return `project:${projectId}`;
}

export function targetKey(target: LoadTarget): string {
  if (target.level === "clients") {
    return "clients";
  }

  if (target.level === "projects") {
    return clientNodeKey(target.client.id);
  }

  return projectNodeKey(target.project.id);
}

export function emptyNode<T>(): TreeNode<T> {
  return {
    items: [],
    page: 0,
    hasNext: false,
    loading: false,
    error: null,
    loaded: false,
  };
}

export function createInitialTreeState(): TreeState {
  return {
    clients: emptyNode<Client>(),
    projects: {},
    tasks: {},
    expanded: {},
  };
}

export function getTargetNode(
  state: TreeState,
  target: LoadTarget,
): TreeNode<Client> | TreeNode<Project> | TreeNode<Task> | undefined {
  if (target.level === "clients") {
    return state.clients;
  }

  if (target.level === "projects") {
    return state.projects[clientNodeKey(target.client.id)];
  }

  return state.tasks[projectNodeKey(target.project.id)];
}

function startNode<T>(node: TreeNode<T> | undefined): TreeNode<T> {
  const current = node ?? emptyNode<T>();

  return {
    ...current,
    loading: true,
    error: null,
  };
}

function finishPage<T>(
  node: TreeNode<T> | undefined,
  page: number,
  items: T[],
  hasNext: boolean,
): TreeNode<T> {
  const current = node ?? emptyNode<T>();

  return {
    items: page === 1 ? items : [...current.items, ...items],
    page,
    hasNext,
    loading: false,
    error: null,
    loaded: true,
  };
}

function failNode<T>(
  node: TreeNode<T> | undefined,
  error: string,
): TreeNode<T> {
  const current = node ?? emptyNode<T>();

  return {
    ...current,
    loading: false,
    error,
  };
}

export function treeReducer(
  state: TreeState,
  action: TreeAction,
): TreeState {
  switch (action.type) {
    case "loadStart": {
      if (action.target.level === "clients") {
        return { ...state, clients: startNode(state.clients) };
      }

      if (action.target.level === "projects") {
        const key = clientNodeKey(action.target.client.id);

        return {
          ...state,
          projects: {
            ...state.projects,
            [key]: startNode(state.projects[key]),
          },
        };
      }

      const key = projectNodeKey(action.target.project.id);

      return {
        ...state,
        tasks: {
          ...state.tasks,
          [key]: startNode(state.tasks[key]),
        },
      };
    }

    case "loadSuccess": {
      if (action.level === "clients") {
        return {
          ...state,
          clients: finishPage(
            state.clients,
            action.page,
            action.items,
            action.hasNext,
          ),
        };
      }

      if (action.level === "projects") {
        const key = clientNodeKey(action.client.id);

        return {
          ...state,
          projects: {
            ...state.projects,
            [key]: finishPage(
              state.projects[key],
              action.page,
              action.items,
              action.hasNext,
            ),
          },
        };
      }

      const key = projectNodeKey(action.project.id);

      return {
        ...state,
        tasks: {
          ...state.tasks,
          [key]: finishPage(
            state.tasks[key],
            action.page,
            action.items,
            action.hasNext,
          ),
        },
      };
    }

    case "loadError": {
      if (action.target.level === "clients") {
        return {
          ...state,
          clients: failNode(state.clients, action.error),
        };
      }

      if (action.target.level === "projects") {
        const key = clientNodeKey(action.target.client.id);

        return {
          ...state,
          projects: {
            ...state.projects,
            [key]: failNode(state.projects[key], action.error),
          },
        };
      }

      const key = projectNodeKey(action.target.project.id);

      return {
        ...state,
        tasks: {
          ...state.tasks,
          [key]: failNode(state.tasks[key], action.error),
        },
      };
    }

    case "setExpanded":
      return {
        ...state,
        expanded: {
          ...state.expanded,
          [action.key]: action.expanded,
        },
      };
  }
}
