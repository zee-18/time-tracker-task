import { fetchPage } from "../lib/pagination";
import { api } from "./index";
import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";
import type { Client, Project, Task } from "./types";

function removeQueryIfNeeded(key: unknown[], force: boolean): void {
  if (force) {
    void queryClient.removeQueries({ queryKey: key, exact: true });
  }
}

export async function fetchClientsPage(
  page: number,
  pageSize: number,
  options: { force?: boolean } = {},
): Promise<{ items: Client[]; hasNext: boolean }> {
  const key = queryKeys.clientsPage(page, pageSize);
  const force = options.force ?? false;

  removeQueryIfNeeded(key, force);

  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: () =>
      fetchPage(
        (params) => api.clients.list({ ...params, limit: params.limit ?? pageSize, offset: params.offset ?? 0 }),
        { page, pageSize },
      ),
  });
}

export async function fetchProjectsPage(
  clientId: number,
  page: number,
  pageSize: number,
  options: { force?: boolean } = {},
): Promise<{ items: Project[]; hasNext: boolean }> {
  const key = queryKeys.projectsPage(clientId, page, pageSize);
  const force = options.force ?? false;

  removeQueryIfNeeded(key, force);

  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: () =>
      fetchPage(
        (params) =>
          api.projects.listByClient(clientId, {
            ...params,
            limit: params.limit ?? pageSize,
            offset: params.offset ?? 0,
          }),
        { page, pageSize },
      ),
  });
}

export async function fetchTasksPage(
  projectId: number,
  page: number,
  pageSize: number,
  options: { force?: boolean } = {},
): Promise<{ items: Task[]; hasNext: boolean }> {
  const key = queryKeys.tasksPage(projectId, page, pageSize);
  const force = options.force ?? false;

  removeQueryIfNeeded(key, force);

  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: () =>
      fetchPage(
        (params) =>
          api.tasks.listByProject(projectId, {
            ...params,
            limit: params.limit ?? pageSize,
            offset: params.offset ?? 0,
          }),
        { page, pageSize },
      ),
  });
}

export async function fetchTask(
  taskId: number,
  options: { force?: boolean } = {},
): Promise<Task> {
  const key = queryKeys.task(taskId);
  const force = options.force ?? false;

  removeQueryIfNeeded(key, force);

  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: () => api.tasks.get(taskId),
  });
}
