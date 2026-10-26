import { rateLimitError } from "../middleware/errors.js";

type QueueItem = {
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

export type RateQueueOptions = {
  limit?: number;
  windowMs?: number;
  maxQueue?: number;
  maxWaitMs?: number;
  now?: () => number;
};

export class RateQueue {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxQueue: number;
  private readonly maxWaitMs: number;
  private readonly now: () => number;

  private timestamps: number[] = [];
  private queue: QueueItem[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RateQueueOptions = {}) {
    this.limit = options.limit ?? 14;
    this.windowMs = options.windowMs ?? 60_000;
    this.maxQueue = options.maxQueue ?? 30;
    this.maxWaitMs = options.maxWaitMs ?? 20_000;
    this.now = options.now ?? Date.now;
  }

  schedule<T>(run: () => Promise<T>): Promise<T> {
    const now = this.now();
    this.processQueue(now);

    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(rateLimitError(this.secondsUntilSlot(now)));
    }

    const waitMs = this.estimateWaitMs(now);

    if (waitMs > this.maxWaitMs) {
      return Promise.reject(rateLimitError(waitMs / 1000));
    }

    if (this.queue.length === 0 && this.timestamps.length < this.limit) {
      this.timestamps.push(now);
      return Promise.resolve().then(run);
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        run,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.armTimer();
    });
  }

  reset(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.timestamps = [];

    const queued = this.queue;
    this.queue = [];

    for (const item of queued) {
      item.reject(rateLimitError(1));
    }
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;

    while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
      this.timestamps.shift();
    }
  }

  private processQueue(now: number): void {
    this.prune(now);

    while (this.queue.length > 0 && this.timestamps.length < this.limit) {
      const item = this.queue.shift();

      if (!item) {
        break;
      }

      this.timestamps.push(now);
      Promise.resolve()
        .then(item.run)
        .then(item.resolve, item.reject);
    }

    this.armTimer();
  }

  private armTimer(): void {
    if (this.timer !== null || this.queue.length === 0) {
      return;
    }

    const now = this.now();
    this.prune(now);

    if (this.timestamps.length < this.limit) {
      this.processQueue(now);
      return;
    }

    const delay = Math.max(0, this.timestamps[0] + this.windowMs - now);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.processQueue(this.now());
    }, delay);
  }

  private estimateWaitMs(now: number): number {
    if (this.queue.length === 0 && this.timestamps.length < this.limit) {
      return 0;
    }

    const active = this.timestamps
      .filter((timestamp) => timestamp + this.windowMs > now)
      .sort((a, b) => a - b);

    let dispatchAt = now;

    for (let itemIndex = 0; itemIndex <= this.queue.length; itemIndex += 1) {
      if (active.length >= this.limit) {
        dispatchAt = Math.max(dispatchAt, active[0] + this.windowMs);

        while (
          active.length > 0 &&
          active[0] + this.windowMs <= dispatchAt
        ) {
          active.shift();
        }
      }

      active.push(dispatchAt);
      active.sort((a, b) => a - b);
    }

    return Math.max(0, dispatchAt - now);
  }

  private secondsUntilSlot(now: number): number {
    this.prune(now);

    if (this.timestamps.length === 0) {
      return 1;
    }

    const waitMs = this.timestamps[0] + this.windowMs - now;
    return Math.max(1, Math.ceil(waitMs / 1000));
  }
}

export const upstreamQueue = new RateQueue();
