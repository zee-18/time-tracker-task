import { HttpError, rateLimitError } from "../middleware/errors.js";
import { upstreamQueue } from "../middleware/rateQueue.js";

const DEFAULT_BASE_URL =
  "https://interview-api.memtime-demo.deno.net/api/v1";
const DEFAULT_TIMEOUT_MS = 10_000;

export type UpstreamMethod = "GET" | "POST" | "PUT" | "DELETE";

export type UpstreamRequest = {
  method: UpstreamMethod;
  path: string;
  query?: Record<string, string | number>;
  body?: unknown;
};

function getApiKey(): string {
  const key = process.env.MEMTIME_API_KEY?.trim();

  if (!key) {
    throw new Error(
      "MEMTIME_API_KEY is not set. Add it to .env before starting the server.",
    );
  }

  return key;
}

export function assertUpstreamConfigured(): void {
  getApiKey();
}

function getBaseUrl(): string {
  const configured = process.env.MEMTIME_BASE_URL?.trim();
  const baseUrl = configured && configured.length > 0
    ? configured
    : DEFAULT_BASE_URL;

  return baseUrl.replace(/\/+$/, "");
}

function getTimeoutMs(): number {
  const configured = Number(process.env.UPSTREAM_TIMEOUT_MS);

  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return configured;
}

function upstreamError(): HttpError {
  return new HttpError(
    502,
    "UPSTREAM_ERROR",
    "Can't reach the server. Please try again.",
  );
}

function timeoutError(): HttpError {
  return new HttpError(
    504,
    "UPSTREAM_TIMEOUT",
    "The server took too long to respond. Please try again.",
  );
}

function badRequestError(): HttpError {
  return new HttpError(
    400,
    "BAD_REQUEST",
    "Something went wrong with the data we sent. Please try again.",
  );
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(1, Math.ceil(seconds));
  }

  const date = Date.parse(value);

  if (!Number.isNaN(date)) {
    return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  }

  return undefined;
}

function readUpstreamMessage(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof parsed.error === "string"
    ) {
      return parsed.error;
    }
  } catch {
    return body;
  }

  return body;
}

function notFoundError(body: string): HttpError {
  const message = readUpstreamMessage(body);

  if (/task/i.test(message)) {
    return new HttpError(
      404,
      "TASK_NOT_FOUND",
      "This task no longer exists. Pick another task.",
    );
  }

  return new HttpError(
    404,
    "ENTRY_NOT_FOUND",
    "This entry could not be found on the server. It may have been removed.",
  );
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  if (text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw upstreamError();
  }
}

async function performRequest(request: UpstreamRequest): Promise<unknown> {
  let url: URL;

  try {
    url = new URL(`${getBaseUrl()}${request.path}`);

    for (const [key, value] of Object.entries(request.query ?? {})) {
      url.searchParams.set(key, String(value));
    }
  } catch {
    throw upstreamError();
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, getTimeoutMs());

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: "application/json",
    };

    if (request.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method: request.method,
      headers,
      body:
        request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: controller.signal,
    });

    if (response.status === 400) {
      throw badRequestError();
    }

    if (response.status === 404) {
      throw notFoundError(await response.text());
    }

    if (response.status === 429) {
      const retryAfterSeconds =
        parseRetryAfter(response.headers.get("retry-after")) ?? 60;
      throw rateLimitError(retryAfterSeconds);
    }

    if (!response.ok) {
      throw upstreamError();
    }

    return await parseResponseBody(response);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (timedOut) {
      throw timeoutError();
    }

    throw upstreamError();
  } finally {
    clearTimeout(timeout);
  }
}

export function upstream<T = unknown>(
  request: UpstreamRequest,
): Promise<T> {
  return upstreamQueue
    .schedule(() => performRequest(request))
    .then((value) => value as T);
}
