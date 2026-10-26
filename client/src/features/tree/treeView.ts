import type { Client, Project, Task } from "../../api/types";
import {
  clientNodeKey,
  projectNodeKey,
  type TreeState,
} from "./treeState";

export interface VisibleProject {
  project: Project;
  tasks: Task[];
}

export interface VisibleClient {
  client: Client;
  projects: VisibleProject[];
}

interface BaseRow {
  key: string;
  level: number;
  parentKey: string | null;
  selected: boolean;
}

export interface AllRow extends BaseRow {
  kind: "all";
  level: 1;
  parentKey: null;
}

export interface ClientRow extends BaseRow {
  kind: "client";
  client: Client;
  level: 1;
  parentKey: "all";
  expanded: boolean;
}

export interface ProjectRow extends BaseRow {
  kind: "project";
  project: Project;
  client: Client;
  level: 2;
  parentKey: string;
  expanded: boolean;
}

export interface TaskRow extends BaseRow {
  kind: "task";
  task: Task;
  project: Project;
  client: Client;
  level: 3;
  parentKey: string;
}

export type TreeRow = AllRow | ClientRow | ProjectRow | TaskRow;

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function matchesName(name: string, query: string): boolean {
  return normalized(name).includes(query);
}

export function buildVisibleTree(
  state: TreeState,
  query: string,
): VisibleClient[] {
  const isSearching = normalized(query).length > 0;
  const search = normalized(query);
  const visible: VisibleClient[] = [];

  for (const client of state.clients.items) {
    const projectNode = state.projects[clientNodeKey(client.id)];
    const projects: VisibleProject[] = [];

    for (const project of projectNode?.items ?? []) {
      const taskNode = state.tasks[projectNodeKey(project.id)];
      const tasks = taskNode?.items ?? [];

      if (!isSearching) {
        projects.push({ project, tasks });
        continue;
      }

      const matchingTasks = tasks.filter((task) =>
        matchesName(task.name, search),
      );

      if (
        matchesName(project.name, search) ||
        matchingTasks.length > 0
      ) {
        projects.push({ project, tasks: matchingTasks });
      }
    }

    if (
      !isSearching ||
      matchesName(client.name, search) ||
      projects.length > 0
    ) {
      visible.push({ client, projects });
    }
  }

  return visible;
}

export interface FlattenTreeOptions {
  selectedTaskId: number | null;
  isSearching: boolean;
}

export function flattenTree(
  visibleClients: VisibleClient[],
  state: TreeState,
  { selectedTaskId, isSearching }: FlattenTreeOptions,
): TreeRow[] {
  const rows: TreeRow[] = [
    {
      kind: "all",
      key: "all",
      level: 1,
      parentKey: null,
      selected: selectedTaskId === null,
    },
  ];

  for (const { client, projects } of visibleClients) {
    const clientKey = clientNodeKey(client.id);
    const clientExpanded =
      state.expanded[clientKey] === true ||
      (isSearching && projects.length > 0);

    rows.push({
      kind: "client",
      key: clientKey,
      level: 1,
      parentKey: "all",
      selected: false,
      client,
      expanded: clientExpanded,
    });

    if (!clientExpanded) {
      continue;
    }

    for (const { project, tasks } of projects) {
      const projectKey = projectNodeKey(project.id);
      const projectExpanded =
        state.expanded[projectKey] === true ||
        (isSearching && tasks.length > 0);

      rows.push({
        kind: "project",
        key: projectKey,
        level: 2,
        parentKey: clientKey,
        selected: false,
        project,
        client,
        expanded: projectExpanded,
      });

      if (!projectExpanded) {
        continue;
      }

      for (const task of tasks) {
        rows.push({
          kind: "task",
          key: `task:${task.id}`,
          level: 3,
          parentKey: projectKey,
          selected:
            selectedTaskId !== null && task.id === selectedTaskId,
          task,
          project,
          client,
        });
      }
    }
  }

  return rows;
}
