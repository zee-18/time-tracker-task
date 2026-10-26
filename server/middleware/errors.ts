import type { NextFunction, Request, Response } from "express";
import log from "../src/logger.js";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function rateLimitError(retryAfterSeconds: number): HttpError {
  return new HttpError(
    429,
    "RATE_LIMITED",
    "Too many requests. Please try again shortly.",
    Math.max(1, Math.ceil(retryAfterSeconds)),
  );
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    message: "Not found.",
    code: "NOT_FOUND",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const errorMessage =
    error instanceof Error ? error.message : "Unknown error";

  log("error", "request failed", {
    method: req.method,
    path: req.path,
    message: errorMessage,
  });

  if (error instanceof HttpError) {
    const body: Record<string, unknown> = {
      message: error.message,
      code: error.code,
    };

    if (error.retryAfterSeconds !== undefined) {
      body.retryAfterSeconds = error.retryAfterSeconds;
    }

    res.status(error.status).json(body);
    return;
  }

  if (isRecord(error) && error.type === "entity.parse.failed") {
    res.status(400).json({
      message: "Something went wrong with the data we sent. Please try again.",
      code: "INVALID_JSON",
    });
    return;
  }

  if (isRecord(error) && error.type === "entity.too.large") {
    res.status(413).json({
      message: "Request body is too large.",
      code: "PAYLOAD_TOO_LARGE",
    });
    return;
  }

  res.status(500).json({
    message: "Something went wrong. Please try again.",
    code: "INTERNAL_ERROR",
  });
}
