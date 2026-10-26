type CacheValue = {
  expiresAt: number;
  value: unknown;
};

type CachePending = {
  promise: Promise<unknown>;
};

type CacheEntry = CacheValue | CachePending;

type CacheOptions = {
  ttlMs: number | (() => number);
  now?: () => number;
};

function isPending(entry: CacheEntry): entry is CachePending {
  return "promise" in entry;
}

export class ReferenceCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly ttlMs: () => number;
  private readonly now: () => number;

  constructor(options: CacheOptions) {
    this.ttlMs =
      typeof options.ttlMs === "function"
        ? options.ttlMs
        : () => options.ttlMs as number;
    this.now = options.now ?? (() => Date.now());
  }

  getOrLoad<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    const now = this.now();

    if (existing) {
      if (isPending(existing)) {
        return existing.promise as Promise<T>;
      }

      if (existing.expiresAt > now) {
        return Promise.resolve(existing.value as T);
      }

      this.entries.delete(key);
    }

    const pending: CachePending = { promise: Promise.resolve() };
    pending.promise = load().then(
      (value) => {
        if (this.entries.get(key) === pending) {
          this.entries.set(key, {
            expiresAt: this.now() + Math.max(0, this.ttlMs()),
            value,
          });
        }

        return value;
      },
      (error: unknown) => {
        if (this.entries.get(key) === pending) {
          this.entries.delete(key);
        }

        throw error;
      },
    );

    this.entries.set(key, pending);
    return pending.promise as Promise<T>;
  }

  clear(): void {
    this.entries.clear();
  }
}

export function cacheKey(
  path: string,
  query: Record<string, string | number> = {},
): string {
  const search = new URLSearchParams();

  for (const key of Object.keys(query).sort()) {
    search.set(key, String(query[key]));
  }

  const serialized = search.toString();
  return serialized.length > 0 ? `${path}?${serialized}` : path;
}

function cacheTtlMsFromEnv(): number {
  const raw = process.env.CACHE_TTL_SECONDS;

  if (raw === undefined || raw.trim() === "") {
    return 60_000;
  }

  const seconds = Number(raw);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return 60_000;
  }

  return seconds * 1000;
}

export const referenceCache = new ReferenceCache({
  ttlMs: cacheTtlMsFromEnv,
});
