import { api } from "../api";
import type { Entry } from "../api/types";

export const MAX_PAGE_SIZE = 499;
export const ENTRY_SLICE_SIZE = 500;
export const MAX_ENTRY_SLICES = 3;
export const ENTRY_FETCH_CAP = ENTRY_SLICE_SIZE * MAX_ENTRY_SLICES;

export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  hasNext: boolean;
}

export type PageFetcher<T> = (params: {
  limit: number;
  offset: number;
}) => Promise<T[]>;

export interface FetchAllEntriesOptions {
  signal?: AbortSignal;
}

function validatePageRequest(page: number, pageSize: number): void {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("page must be a whole number of 1 or higher.");
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("pageSize must be a whole number of 1 or higher.");
  }

  if (pageSize > MAX_PAGE_SIZE) {
    throw new Error(
      "pageSize must be 499 or less because the API caps limit at 500.",
    );
  }
}

export async function fetchPage<T>(
  fetcher: PageFetcher<T>,
  { page, pageSize }: PageRequest,
): Promise<PageResult<T>> {
  validatePageRequest(page, pageSize);

  const offset = (page - 1) * pageSize;
  const received = await fetcher({
    limit: pageSize + 1,
    offset,
  });

  return {
    items: received.slice(0, pageSize),
    hasNext: received.length > pageSize,
  };
}

export async function fetchAllEntries(
  options: FetchAllEntriesOptions = {},
): Promise<{ items: Entry[]; truncated: boolean }> {
  const items: Entry[] = [];
  let truncated = false;

  for (let slice = 0; slice < MAX_ENTRY_SLICES; slice += 1) {
    const batch = await api.entries.list(
      {
        limit: ENTRY_SLICE_SIZE,
        offset: slice * ENTRY_SLICE_SIZE,
        sortBy: "start",
        order: "desc",
      },
      { signal: options.signal },
    );

    items.push(...batch);

    if (batch.length < ENTRY_SLICE_SIZE) {
      truncated = false;
      break;
    }

    if (slice === MAX_ENTRY_SLICES - 1) {
      truncated = true;
    }
  }

  return { items, truncated };
}
