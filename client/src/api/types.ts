export interface Client {
  id: number;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  clientId: number;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  projectId: number;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Entry {
  id: number;
  taskId: number;
  comment: string;
  start: string;
  end: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntryInput {
  taskId: number;
  comment: string;
  start: string;
  end: string;
}

export interface ApiError {
  message: string;
  code: string;
  retryAfterSeconds?: number;
}

export const API_ERROR_CODES = [
  "BAD_REQUEST",
  "TASK_NOT_FOUND",
  "ENTRY_NOT_FOUND",
  "ENTRY_ID_LOCKED",
  "RATE_LIMITED",
  "UPSTREAM_ERROR",
  "UPSTREAM_TIMEOUT",
  "NETWORK_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ListParams {
  limit?: number;
  offset?: number;
}

export interface EntryListParams extends ListParams {
  sortBy: "start";
  order: "asc" | "desc";
}
