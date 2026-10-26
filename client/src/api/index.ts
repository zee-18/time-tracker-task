import { ApiRequestError, request } from "./http";
import type {
  Client,
  Entry,
  EntryInput,
  EntryListParams,
  ListParams,
  Project,
  Task,
} from "./types";

const DEFAULT_LIST_LIMIT = 10;

export interface ReadOptions {
  force?: boolean;
  signal?: AbortSignal;
}

export interface RequestCallOptions {
  signal?: AbortSignal;
}

function normalizeListParams(params: ListParams): {
  limit: number;
  offset: number;
} {
  return {
    limit: params.limit ?? DEFAULT_LIST_LIMIT,
    offset: params.offset ?? 0,
  };
}

function assertMutableEntryId(id: number): void {
  if (id === 0) {
    throw new ApiRequestError(
      "This entry can't be changed because of a known API issue.",
      "ENTRY_ID_LOCKED",
      400,
    );
  }
}

export const api = {
  clients: {
    list(
      params: ListParams = {},
      _options: ReadOptions = {},
    ): Promise<Client[]> {
      const query = normalizeListParams(params);
      return request<Client[]>("/clients", { query });
    },
  },

  projects: {
    listByClient(
      clientId: number,
      params: ListParams = {},
      _options: ReadOptions = {},
    ): Promise<Project[]> {
      const query = normalizeListParams(params);
      return request<Project[]>(`/clients/${clientId}/projects`, { query });
    },
  },

  tasks: {
    listByProject(
      projectId: number,
      params: ListParams = {},
      _options: ReadOptions = {},
    ): Promise<Task[]> {
      const query = normalizeListParams(params);
      return request<Task[]>(`/projects/${projectId}/tasks`, { query });
    },

    get(id: number, _options: ReadOptions = {}): Promise<Task> {
      return request<Task>(`/tasks/${id}`);
    },
  },

  entries: {
    list(
      params: EntryListParams,
      options: RequestCallOptions = {},
    ): Promise<Entry[]> {
      return request<Entry[]>("/time-entries", {
        query: {
          limit: params.limit ?? DEFAULT_LIST_LIMIT,
          offset: params.offset ?? 0,
          sortBy: params.sortBy,
          order: params.order,
        },
        signal: options.signal,
      });
    },

    get(
      id: number,
      options: RequestCallOptions = {},
    ): Promise<Entry> {
      return request<Entry>(`/time-entries/${id}`, {
        signal: options.signal,
      });
    },

    create(
      input: EntryInput,
      options: RequestCallOptions = {},
    ): Promise<Entry> {
      return request<Entry>("/time-entries", {
        method: "POST",
        body: input,
        signal: options.signal,
      });
    },

    async update(
      id: number,
      input: EntryInput,
      options: RequestCallOptions = {},
    ): Promise<Entry> {
      assertMutableEntryId(id);

      return request<Entry>(`/time-entries/${id}`, {
        method: "PUT",
        body: input,
        signal: options.signal,
      });
    },

    async remove(
      id: number,
      options: RequestCallOptions = {},
    ): Promise<void> {
      assertMutableEntryId(id);

      await request<{ ok: true }>(`/time-entries/${id}`, {
        method: "DELETE",
        signal: options.signal,
      });
    },
  },
};
