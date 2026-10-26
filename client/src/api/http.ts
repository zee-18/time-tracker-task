import { isAbortError, throwIfAborted } from "./abort";
import { pauseForRateLimit, waitForRateLimit } from "./rateLimit";

export const API_BASE = "/api";
export const NETWORK_ERROR_CODE = "NETWORK_ERROR";
export const NETWORK_ERROR_MESSAGE =
  "Can't reach the server. Please try again.";
const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
const MAX_RATE_LIMIT_RETRIES = 3;

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    code: string,
    status: number,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isApiError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function buildUrl(
  path: string,
  query?: RequestOptions["query"],
): string {
  const url = `${API_BASE}${path}`;

  if (!query) {
    return url;
  }

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }

  const queryString = search.toString();

  return queryString.length > 0 ? `${url}?${queryString}` : url;
}

function parseRetryAfterHeader(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(1, Math.ceil(seconds));
  }

  const timestamp = Date.parse(value);

  if (!Number.isNaN(timestamp)) {
    return Math.max(1, Math.ceil((timestamp - Date.now()) / 1_000));
  }

  return undefined;
}

async function parseErrorResponse(
  response: Response,
): Promise<ApiRequestError> {
  let body: unknown = null;

  try {
    const text = await response.text();

    if (text.trim().length > 0) {
      body = JSON.parse(text) as unknown;
    }
  } catch {
    body = null;
  }

  const record = isRecord(body) ? body : {};
  const message =
    typeof record.message === "string" && record.message.trim().length > 0
      ? record.message
      : GENERIC_ERROR_MESSAGE;
  const bodyCode =
    typeof record.code === "string" && record.code.trim().length > 0
      ? record.code
      : undefined;
  const code =
    bodyCode ??
    (response.status === 429 ? "RATE_LIMITED" : `HTTP_${response.status}`);

  let retryAfterSeconds: number | undefined;

  if (
    typeof record.retryAfterSeconds === "number" &&
    Number.isFinite(record.retryAfterSeconds) &&
    record.retryAfterSeconds >= 0
  ) {
    retryAfterSeconds = Math.max(1, Math.ceil(record.retryAfterSeconds));
  } else {
    retryAfterSeconds = parseRetryAfterHeader(
      response.headers.get("retry-after"),
    );
  }

  return new ApiRequestError(
    message,
    code,
    response.status,
    retryAfterSeconds,
  );
}

async function parseSuccessResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (text.trim().length === 0) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiRequestError(
      GENERIC_ERROR_MESSAGE,
      "INVALID_RESPONSE",
      response.status,
    );
  }
}

function backoffSeconds(retryNumber: number): number {
  return 2 ** (retryNumber + 1);
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    query,
    body,
    signal,
  } = options;
  const url = buildUrl(path, query);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let retries = 0;

  for (;;) {
    throwIfAborted(signal);
    await waitForRateLimit(signal);
    throwIfAborted(signal);

    let response: Response;

    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        throw error;
      }

      throw new ApiRequestError(
        NETWORK_ERROR_MESSAGE,
        NETWORK_ERROR_CODE,
        0,
      );
    }

    if (response.status === 429) {
      const error = await parseErrorResponse(response);
      const delaySeconds =
        error.retryAfterSeconds ?? backoffSeconds(retries);
      const jitterMs =
        error.retryAfterSeconds === undefined
          ? Math.floor(Math.random() * 500)
          : 0;

      pauseForRateLimit(delaySeconds * 1_000 + jitterMs);

      if (retries >= MAX_RATE_LIMIT_RETRIES) {
        throw error;
      }

      retries += 1;
      continue;
    }

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    return parseSuccessResponse<T>(response);
  }
}
