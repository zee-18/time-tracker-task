import { useSyncExternalStore } from "react";
import type { Client, Project, Task } from "../../api/types";

export type Selection =
  | { view: "all" }
  | {
      view: "task";
      task: Task;
      project: Project;
      client: Client;
    };

export interface TaskPath {
  task: Task;
  project: Project;
  client: Client;
}

let selection: Selection = { view: "all" };
let taskPathsRevision = 0;
const listeners = new Set<() => void>();
const taskPaths = new Map<number, TaskPath>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getSelection(): Selection {
  return selection;
}

export function selectAll(): void {
  if (selection.view === "all") {
    return;
  }

  selection = { view: "all" };
  emit();
}

export function selectTask(
  task: Task,
  project: Project,
  client: Client,
): void {
  taskPaths.set(task.id, { task, project, client });
  taskPathsRevision += 1;
  selection = { view: "task", task, project, client };
  emit();
}

export function rememberTaskPaths(
  tasks: Task[],
  project: Project,
  client: Client,
): void {
  let changed = false;

  for (const task of tasks) {
    const existing = taskPaths.get(task.id);

    if (
      existing === undefined ||
      existing.task !== task ||
      existing.project !== project ||
      existing.client !== client
    ) {
      taskPaths.set(task.id, { task, project, client });
      changed = true;
    }
  }

  if (changed) {
    taskPathsRevision += 1;
    emit();
  }
}

export function getTaskPath(taskId: number): TaskPath | undefined {
  return taskPaths.get(taskId);
}

function getTaskPathsRevision(): number {
  return taskPathsRevision;
}

export function useTaskPathsRevision(): number {
  return useSyncExternalStore(
    subscribe,
    getTaskPathsRevision,
    getTaskPathsRevision,
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useSelection(): Selection {
  return useSyncExternalStore(subscribe, getSelection, getSelection);
}
