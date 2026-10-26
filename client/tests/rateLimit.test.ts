import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRateLimitState,
  pauseForRateLimit,
  waitForRateLimit,
} from "../src/api/rateLimit";

afterEach(() => {
  vi.useRealTimers();
});

describe("rate limit wait", () => {
  it("hides short waits and counts down long waits", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    pauseForRateLimit(1_000);
    expect(getRateLimitState()).toEqual({
      isWaiting: false,
      secondsLeft: 0,
    });

    await vi.advanceTimersByTimeAsync(1_000);

    pauseForRateLimit(5_000);
    expect(getRateLimitState()).toEqual({
      isWaiting: true,
      secondsLeft: 5,
    });

    await vi.advanceTimersByTimeAsync(2_000);
    expect(getRateLimitState()).toEqual({
      isWaiting: true,
      secondsLeft: 3,
    });

    await vi.advanceTimersByTimeAsync(3_000);
    expect(getRateLimitState()).toEqual({
      isWaiting: false,
      secondsLeft: 0,
    });
  });

  it("resolves waiters when the pause ends", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    pauseForRateLimit(2_000);
    const waiting = waitForRateLimit();

    await vi.advanceTimersByTimeAsync(2_000);

    await expect(waiting).resolves.toBeUndefined();
  });

  it("rejects a waiting request when its signal aborts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    pauseForRateLimit(5_000);
    const controller = new AbortController();
    const waiting = waitForRateLimit(controller.signal);

    controller.abort();

    await expect(waiting).rejects.toThrow("aborted");

    await vi.advanceTimersByTimeAsync(5_000);
  });
});
