import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Entry } from "../src/api/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock("../src/api", () => ({
  api: {
    entries: {
      list: mocks.list,
    },
  },
}));

import {
  ENTRY_SLICE_SIZE,
  fetchAllEntries,
  fetchPage,
} from "../src/lib/pagination";

function makeEntries(count: number): Entry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    taskId: 1,
    comment: `Entry ${index}`,
    start: new Date(2025, 10, 1, 0, index).toISOString(),
    end: new Date(2025, 10, 1, 1, index).toISOString(),
    createdAt: new Date(2025, 10, 1).toISOString(),
    updatedAt: new Date(2025, 10, 1).toISOString(),
  }));
}

describe("fetchPage", () => {
  it("asks for one extra item and reports whether a next page exists", async () => {
    const fetcher = vi.fn(async () => ["a", "b", "c"]);

    const result = await fetchPage(fetcher, { page: 2, pageSize: 2 });

    expect(fetcher).toHaveBeenCalledWith({ limit: 3, offset: 2 });
    expect(result).toEqual({ items: ["a", "b"], hasNext: true });
  });

  it("reports no next page when the result is short", async () => {
    const fetcher = vi.fn(async () => ["a", "b"]);

    const result = await fetchPage(fetcher, { page: 1, pageSize: 2 });

    expect(result).toEqual({ items: ["a", "b"], hasNext: false });
  });

  it("rejects page sizes above the proxy limit", async () => {
    const fetcher = vi.fn(async () => []);

    await expect(
      fetchPage(fetcher, { page: 1, pageSize: 500 }),
    ).rejects.toThrow("pageSize must be 499 or less");
  });
});

describe("fetchAllEntries", () => {
  beforeEach(() => {
    mocks.list.mockReset();
  });

  it("keeps the entry sort fixed and stops on a short slice", async () => {
    mocks.list
      .mockResolvedValueOnce(makeEntries(ENTRY_SLICE_SIZE))
      .mockResolvedValueOnce(makeEntries(12));

    const result = await fetchAllEntries();

    expect(result.items).toHaveLength(ENTRY_SLICE_SIZE + 12);
    expect(result.truncated).toBe(false);
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.list).toHaveBeenNthCalledWith(
      1,
      {
        limit: 500,
        offset: 0,
        sortBy: "start",
        order: "desc",
      },
      { signal: undefined },
    );
    expect(mocks.list).toHaveBeenNthCalledWith(
      2,
      {
        limit: 500,
        offset: 500,
        sortBy: "start",
        order: "desc",
      },
      { signal: undefined },
    );
  });

  it("marks the result truncated when the safety cap is reached", async () => {
    mocks.list.mockResolvedValue(makeEntries(ENTRY_SLICE_SIZE));

    const result = await fetchAllEntries();

    expect(result.items).toHaveLength(ENTRY_SLICE_SIZE * 3);
    expect(result.truncated).toBe(true);
    expect(mocks.list).toHaveBeenCalledTimes(3);
  });
});
