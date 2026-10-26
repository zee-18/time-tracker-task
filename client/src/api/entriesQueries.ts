import { useQuery, type QueryClient } from "@tanstack/react-query";
import { fetchAllEntries, fetchPage } from "../lib/pagination";
import { api } from "./index";
import { queryKeys } from "./queryKeys";
import type { Entry } from "./types";

export function entryKey(entry: Pick<Entry, "id" | "createdAt">): string {
  return `${entry.id}-${entry.createdAt}`;
}

export function getKnownEntries(
  queryClient: QueryClient,
): Entry[] {
  const allData = queryClient.getQueryData<{ items: Entry[]; truncated: boolean }>(
    queryKeys.entriesAll(),
  );

  if (allData !== undefined) {
    return [...allData.items];
  }

  const cachedPages = queryClient.getQueriesData({
    queryKey: ["entries", "page"],
  });

  const items = cachedPages.flatMap(([, data]) => {
    if (typeof data !== "object" || data === null || !Array.isArray((data as { items?: Entry[] }).items)) {
      return [];
    }

    return (data as { items: Entry[] }).items;
  });

  const deduped = new Map<string, Entry>();

  for (const entry of items) {
    deduped.set(entryKey(entry), entry);
  }

  return Array.from(deduped.values());
}

export function useAllEntries(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.entriesAll(),
    queryFn: async () => fetchAllEntries(),
    enabled: options.enabled,
  });
}

export function useEntriesPage(page: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.entriesPage(page, pageSize),
    queryFn: async () =>
      fetchPage(
        (params) =>
          api.entries.list(
            {
              ...params,
              sortBy: "start",
              order: "desc",
            },
            {}),
        { page, pageSize },
      ),
    placeholderData: (previous) => previous,
  });
}

export function refreshEntries(): Promise<void> {
  return Promise.resolve();
}
