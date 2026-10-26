import { useSyncExternalStore } from "react";
import { createAbortError, throwIfAborted } from "./abort";

export interface RateLimitState {
  isWaiting: boolean;
  secondsLeft: number;
}

const SHOW_COUNTDOWN_MS = 3_000;
const TICK_MS = 250;

let pausedUntil = 0;
let showCountdown = false;
let ticker: ReturnType<typeof setInterval> | null = null;
let state: RateLimitState = { isWaiting: false, secondsLeft: 0 };
const listeners = new Set<() => void>();

function emit(next: RateLimitState): void {
  if (
    next.isWaiting === state.isWaiting &&
    next.secondsLeft === state.secondsLeft
  ) {
    return;
  }

  state = next;

  for (const listener of listeners) {
    listener();
  }
}

function stopTicker(): void {
  if (ticker !== null) {
    clearInterval(ticker);
    ticker = null;
  }
}

function startTicker(): void {
  if (ticker !== null) {
    return;
  }

  ticker = setInterval(() => {
    updateCountdown();
  }, TICK_MS);
}

function updateCountdown(): void {
  const remainingMs = pausedUntil - Date.now();

  if (remainingMs <= 0) {
    pausedUntil = 0;
    showCountdown = false;
    stopTicker();
    emit({ isWaiting: false, secondsLeft: 0 });
    return;
  }

  if (!showCountdown) {
    emit({ isWaiting: false, secondsLeft: 0 });
    return;
  }

  emit({
    isWaiting: true,
    secondsLeft: Math.max(1, Math.ceil(remainingMs / 1_000)),
  });
}

export function pauseForRateLimit(delayMs: number): void {
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return;
  }

  const now = Date.now();

  if (pausedUntil <= now) {
    pausedUntil = 0;
    showCountdown = false;
  }

  pausedUntil = Math.max(pausedUntil, now + delayMs);

  if (pausedUntil - now >= SHOW_COUNTDOWN_MS) {
    showCountdown = true;
    startTicker();
  }

  updateCountdown();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = (): void => {
      cleanup();
      reject(createAbortError());
    };

    const cleanup = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function waitForRateLimit(signal?: AbortSignal): Promise<void> {
  for (;;) {
    throwIfAborted(signal);

    const remainingMs = pausedUntil - Date.now();

    if (remainingMs <= 0) {
      return;
    }

    await sleep(remainingMs, signal);
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RateLimitState {
  return state;
}

export function getRateLimitState(): RateLimitState {
  return state;
}

export function useRateLimit(): RateLimitState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
