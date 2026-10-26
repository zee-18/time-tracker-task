import type { Entry } from "../api/types";

function getValidDate(value: string | null | undefined): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getDefaultTimes(
  knownEntries: Array<Pick<Entry, "end">>,
  now: Date,
): { start: Date; end: Date } {
  const end = new Date(now);
  end.setSeconds(0, 0);
  end.setMilliseconds(0);

  let lastEntryEnd: Date | null = null;

  for (const entry of knownEntries) {
    const candidate = getValidDate(entry.end);

    if (candidate === null) {
      continue;
    }

    if (candidate.getTime() > now.getTime()) {
      continue;
    }

    if (
      lastEntryEnd === null ||
      candidate.getTime() > lastEntryEnd.getTime()
    ) {
      lastEntryEnd = candidate;
    }
  }

  let start = new Date(end.getTime() - 30 * 60_000);

  if (
    lastEntryEnd !== null &&
    sameLocalDay(lastEntryEnd, end) &&
    lastEntryEnd.getTime() <= end.getTime() - 60_000
  ) {
    start = new Date(lastEntryEnd);
  }

  if (start.getTime() >= end.getTime()) {
    start = new Date(end.getTime() - 30 * 60_000);
  }

  return { start, end };
}

export function isSmartStartUsed(
  knownEntries: Array<Pick<Entry, "end">>,
  now: Date,
  start: Date,
  end: Date,
): boolean {
  const endFloor = new Date(end);
  endFloor.setSeconds(0, 0);
  endFloor.setMilliseconds(0);

  let lastEntryEnd: Date | null = null;

  for (const entry of knownEntries) {
    const candidate = getValidDate(entry.end);

    if (candidate === null) {
      continue;
    }

    if (candidate.getTime() > now.getTime()) {
      continue;
    }

    if (
      lastEntryEnd === null ||
      candidate.getTime() > lastEntryEnd.getTime()
    ) {
      lastEntryEnd = candidate;
    }
  }

  if (lastEntryEnd === null) {
    return false;
  }

  return (
    sameLocalDay(lastEntryEnd, endFloor) &&
    lastEntryEnd.getTime() <= endFloor.getTime() - 60_000 &&
    start.getTime() === lastEntryEnd.getTime()
  );
}
