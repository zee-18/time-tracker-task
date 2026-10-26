import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./errors.js";

export type ListQuery = {
  limit: number;
  offset: number;
};

export type EntriesQuery = ListQuery & {
  sortBy: "start";
  order: "asc" | "desc";
};

export type EntryBody = {
  taskId: number;
  comment: string;
  start: string;
  end: string;
};

const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidInput(code: string, message: string): HttpError {
  return new HttpError(400, code, message);
}

function parseWholeNumber(value: string, name: string): number {
  if (!/^\d+$/.test(value)) {
    throw invalidInput("INVALID_QUERY", `${name} must be a whole number.`);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw invalidInput("INVALID_QUERY", `${name} is too large.`);
  }

  return parsed;
}

function readOptionalString(
  query: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = query[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw invalidInput("INVALID_QUERY", `Invalid ${key}.`);
  }

  return value;
}

function parseLimit(value: string): number {
  if (!/^-?\d+$/.test(value)) {
    throw invalidInput("INVALID_QUERY", "limit must be a whole number.");
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw invalidInput("INVALID_QUERY", "limit is too large.");
  }

  return Math.min(500, Math.max(1, parsed));
}

function parseListQuery(query: Record<string, unknown>): ListQuery {
  const rawLimit = readOptionalString(query, "limit");
  const rawOffset = readOptionalString(query, "offset");

  const limit = rawLimit === undefined ? 10 : parseLimit(rawLimit);
  const offset =
    rawOffset === undefined ? 0 : parseWholeNumber(rawOffset, "offset");

  return { limit, offset };
}

function parseEntriesQuery(query: Record<string, unknown>): EntriesQuery {
  const listQuery = parseListQuery(query);
  const sortBy = readOptionalString(query, "sortBy") ?? "start";
  const order = readOptionalString(query, "order") ?? "desc";

  if (sortBy !== "start") {
    throw invalidInput("INVALID_QUERY", "Sort by must be start.");
  }

  if (order !== "asc" && order !== "desc") {
    throw invalidInput("INVALID_QUERY", "Order must be asc or desc.");
  }

  return { ...listQuery, sortBy, order };
}

function parseId(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw invalidInput("INVALID_ID", "ID must be a whole number of 0 or higher.");
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw invalidInput("INVALID_ID", "ID is too large.");
  }

  return parsed;
}

function readIdParam(req: Request): number {
  const value = req.params.id;

  if (typeof value !== "string") {
    throw invalidInput("INVALID_ID", "ID must be a whole number of 0 or higher.");
  }

  return parseId(value);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month === 2 && isLeapYear(year) ? 29 : days[month - 1];
}

function parseIsoDate(value: unknown): string {
  if (typeof value !== "string") {
    throw invalidInput(
      "INVALID_BODY",
      "Start and end must be valid ISO 8601 dates.",
    );
  }

  const match = ISO_DATE_TIME.exec(value);

  if (!match) {
    throw invalidInput(
      "INVALID_BODY",
      "Start and end must be valid ISO 8601 dates.",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const zone = match[8];

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw invalidInput(
      "INVALID_BODY",
      "Start and end must be valid ISO 8601 dates.",
    );
  }

  if (zone !== "Z") {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));

    if (offsetHour > 23 || offsetMinute > 59) {
      throw invalidInput(
        "INVALID_BODY",
        "Start and end must be valid ISO 8601 dates.",
      );
    }
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw invalidInput(
      "INVALID_BODY",
      "Start and end must be valid ISO 8601 dates.",
    );
  }

  return new Date(timestamp).toISOString();
}

function parseEntryBody(body: unknown): EntryBody {
  if (!isRecord(body)) {
    throw invalidInput(
      "INVALID_BODY",
      "Something went wrong with the data we sent. Please try again.",
    );
  }

  const taskId = body.taskId;

  if (
    typeof taskId !== "number" ||
    !Number.isSafeInteger(taskId) ||
    taskId < 0
  ) {
    throw invalidInput(
      "INVALID_BODY",
      "Task is required and must be a valid task ID.",
    );
  }

  if (typeof body.comment !== "string") {
    throw invalidInput(
      "INVALID_BODY",
      "Comment must be between 1 and 500 characters.",
    );
  }

  const comment = body.comment.trim();

  if (comment.length < 1 || comment.length > 500) {
    throw invalidInput(
      "INVALID_BODY",
      "Comment must be between 1 and 500 characters.",
    );
  }

  const start = parseIsoDate(body.start);
  const end = parseIsoDate(body.end);

  if (Date.parse(start) >= Date.parse(end)) {
    throw invalidInput(
      "INVALID_BODY",
      "End time must be after the start time.",
    );
  }

  return { taskId, comment, start, end };
}

function runValidation(
  next: NextFunction,
  validate: () => void,
): void {
  try {
    validate();
    next();
  } catch (error) {
    next(error);
  }
}

export function validateIdParam(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  runValidation(next, () => {
    res.locals.id = readIdParam(req);
  });
}

export function validateMutableEntryId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  runValidation(next, () => {
    const id = readIdParam(req);

    if (id === 0) {
      throw new HttpError(
        400,
        "ENTRY_ID_LOCKED",
        "This entry can't be changed because of a known API issue.",
      );
    }

    res.locals.id = id;
  });
}

export function validateListQuery(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  runValidation(next, () => {
    res.locals.query = parseListQuery(req.query);
  });
}

export function validateEntriesQuery(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  runValidation(next, () => {
    res.locals.query = parseEntriesQuery(req.query);
  });
}

export function validateEntryBody(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  runValidation(next, () => {
    res.locals.entryBody = parseEntryBody(req.body);
  });
}
