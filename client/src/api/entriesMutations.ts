import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { api } from "./index";
import { queryKeys } from "./queryKeys";
import type { Entry, EntryInput } from "./types";
import type { PageResult } from "../lib/pagination";
import { entryKey } from "./entriesQueries";

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const aStart = Date.parse(a.start);
    const bStart = Date.parse(b.start);

    if (
      Number.isFinite(aStart) &&
      Number.isFinite(bStart) &&
      aStart !== bStart
    ) {
      return bStart - aStart;
    }

    const byStart = b.start.localeCompare(a.start);

    if (byStart !== 0) {
      return byStart;
    }

    const byCreatedAt = b.createdAt.localeCompare(a.createdAt);

    if (byCreatedAt !== 0) {
      return byCreatedAt;
    }

    return b.id - a.id;
  });
}

function replaceEntry(entries: Entry[], entry: Entry): Entry[] {
  const key = entryKey(entry);

  return entries.map((item) =>
    entryKey(item) === key ? entry : item,
  );
}

function removeEntry(entries: Entry[], entry: Entry): Entry[] {
  const key = entryKey(entry);

  return entries.filter((item) => entryKey(item) !== key);
}

export function applyEntryMutation(
  queryClient: QueryClient,
  mutation: { type: "create" | "update" | "delete"; entry: Entry },
): void {
  const { type, entry } = mutation;
  const key = entryKey(entry);

  queryClient.setQueryData<{ items: Entry[]; truncated: boolean }>(
    queryKeys.entriesAll(),
    (previous) => {
      if (previous === undefined) {
        return previous;
      }

      let items = previous.items;

      if (type === "create") {
        const withoutDuplicate = items.filter(
          (item) => entryKey(item) !== key,
        );
        items = sortEntries([entry, ...withoutDuplicate]);
      } else if (type === "update") {
        if (items.some((item) => entryKey(item) === key)) {
          items = sortEntries(replaceEntry(items, entry));
        }
      } else {
        items = removeEntry(items, entry);
      }

      return { ...previous, items };
    },
  );

  const pageQueries = queryClient.getQueriesData({
    queryKey: ["entries", "page"],
  });

  let entryPage: number | null = null;

  for (const [queryKey, data] of pageQueries) {
    const pageData = data as PageResult<Entry> | undefined;

    if (
      pageData !== undefined &&
      Array.isArray(pageData.items) &&
      pageData.items.some((item) => entryKey(item) === key)
    ) {
      entryPage = Number((queryKey[2] as { page?: number } | undefined)?.page ?? null);
      break;
    }
  }

  for (const [queryKey, data] of pageQueries) {
    const pageData = data as PageResult<Entry> | undefined;

    if (pageData === undefined || !Array.isArray(pageData.items)) {
      continue;
    }

    let nextItems = pageData.items;

    if (type === "create") {
      const withoutDuplicate = nextItems.filter(
        (item) => entryKey(item) !== key,
      );
      nextItems = sortEntries([entry, ...withoutDuplicate]).slice(0, pageData.items.length || 10);
    } else if (type === "update") {
      if (nextItems.some((item) => entryKey(item) === key)) {
        nextItems = sortEntries(replaceEntry(nextItems, entry));
      }
    } else {
      nextItems = removeEntry(nextItems, entry);
    }

    const page = Number((queryKey[2] as { page?: number } | undefined)?.page ?? 1);
    const pageSize = Number(
      (queryKey[2] as { pageSize?: number } | undefined)?.pageSize ??
        (nextItems.length || 10),
    );

    if (nextItems !== pageData.items) {
      queryClient.setQueryData<PageResult<Entry>>(queryKey, {
        ...pageData,
        items: nextItems,
        hasNext: pageData.hasNext,
      });
    }

    if (type === "delete" && entryPage !== null && page > entryPage) {
      queryClient.removeQueries({
        queryKey: queryKey,
        exact: true,
      });
    }

    if (type === "create" && page === 1 && nextItems.length > pageSize) {
      queryClient.setQueryData<PageResult<Entry>>(queryKey, {
        ...pageData,
        items: nextItems.slice(0, pageSize),
      });
    }
  }
}

export function useCreateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EntryInput) => api.entries.create(input),
    onSuccess: (entry) => {
      applyEntryMutation(queryClient, { type: "create", entry });
    },
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: EntryInput }) =>
      api.entries.update(id, input),
    onSuccess: (entry) => {
      applyEntryMutation(queryClient, { type: "update", entry });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entry: Entry) => api.entries.remove(entry.id),
    onSuccess: (_, entry) => {
      applyEntryMutation(queryClient, { type: "delete", entry });
    },
  });
}
