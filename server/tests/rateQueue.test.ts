import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateQueue } from "../middleware/rateQueue.js";

describe("RateQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows 14 calls in the window and queues the next one", async () => {
    let now = 0;
    const queue = new RateQueue({ now: () => now, maxWaitMs: 20_000 });
    const run = vi.fn(async () => "ok");

    await Promise.all(
      Array.from({ length: 14 }, () => queue.schedule(run)),
    );
    expect(run).toHaveBeenCalledTimes(14);

    now = 40_000;
    let fifteenthResolved = false;
    const fifteenth = queue.schedule(async () => {
      fifteenthResolved = true;
      return "fifteenth";
    });
    fifteenth.catch(() => undefined);

    await Promise.resolve();
    expect(fifteenthResolved).toBe(false);

    now = 60_000;
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(fifteenth).resolves.toBe("fifteenth");
    expect(fifteenthResolved).toBe(true);
  });

  it("rejects immediately when the wait would be over 20 seconds", async () => {
    const now = 0;
    const queue = new RateQueue({ now: () => now });
    const run = vi.fn(async () => "ok");

    await Promise.all(
      Array.from({ length: 14 }, () => queue.schedule(run)),
    );

    const rejected = queue.schedule(run);

    await expect(rejected).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      retryAfterSeconds: 60,
    });
    expect(run).toHaveBeenCalledTimes(14);
  });

  it("rejects when the queue is full", async () => {
    const now = 40_000;
    const queue = new RateQueue({
      now: () => now,
      maxWaitMs: 1_000_000,
    });
    const run = vi.fn(async () => "ok");

    await Promise.all(
      Array.from({ length: 14 }, () => queue.schedule(run)),
    );

    const queued = Array.from({ length: 30 }, () => {
      const promise = queue.schedule(run);
      promise.catch(() => undefined);
      return promise;
    });

    await expect(queue.schedule(run)).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      retryAfterSeconds: 60,
    });

    queue.reset();
    await Promise.allSettled(queued);
  });
});
