import { describe, expect, it, vi } from "vitest";
import { cacheKey, ReferenceCache } from "../lib/cache.js";

describe("cacheKey", () => {
  it("includes a sorted validated query string", () => {
    expect(cacheKey("/clients", { offset: 0, limit: 10 })).toBe(
      "/clients?limit=10&offset=0",
    );
    expect(cacheKey("/clients/1")).toBe("/clients/1");
  });
});

describe("ReferenceCache", () => {
  it("returns the cached value until it expires", async () => {
    let now = 0;
    const cache = new ReferenceCache({ ttlMs: 60_000, now: () => now });
    const load = vi.fn(async () => "value");

    await expect(cache.getOrLoad("key", load)).resolves.toBe("value");
    now = 59_999;
    await expect(cache.getOrLoad("key", load)).resolves.toBe("value");
    expect(load).toHaveBeenCalledTimes(1);

    now = 60_000;
    await expect(cache.getOrLoad("key", load)).resolves.toBe("value");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares an identical in-flight request", async () => {
    const cache = new ReferenceCache({ ttlMs: 60_000 });
    let resolveLoad: (value: string) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const first = cache.getOrLoad("key", load);
    const second = cache.getOrLoad("key", load);

    expect(load).toHaveBeenCalledTimes(1);
    resolveLoad("value");

    await expect(Promise.all([first, second])).resolves.toEqual([
      "value",
      "value",
    ]);
  });

  it("does not cache errors", async () => {
    const cache = new ReferenceCache({ ttlMs: 60_000 });
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("nope"))
      .mockResolvedValueOnce("value");

    await expect(cache.getOrLoad("key", load)).rejects.toThrow("nope");
    await expect(cache.getOrLoad("key", load)).resolves.toBe("value");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
