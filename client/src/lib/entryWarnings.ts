import type { Entry } from "../api/types";
import { formatDateTime } from "./dates";

export interface EntryWarning {
  code: string;
  message: string;
}

interface WarningInput {
  start: string;
  end: string;
}

function parseTimestamp(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatDurationLabel(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

function formatOverlapText(entry: Entry): string {
  return `${formatDateTime(entry.start)} to ${formatDateTime(entry.end)}`;
}

export function getWarnings(
  input: WarningInput,
  knownEntries: Entry[],
  editingEntry: Entry | null,
  now: Date,
): EntryWarning[] {
  const startMs = parseTimestamp(input.start);
  const endMs = parseTimestamp(input.end);

  if (startMs === null || endMs === null || endMs <= startMs) {
    return [];
  }

  const warnings: EntryWarning[] = [];
  const durationMs = endMs - startMs;

  if (durationMs > 12 * 60 * 60 * 1000) {
    warnings.push({
      code: "LONG",
      message: `This entry is longer than 12 hours (${formatDurationLabel(durationMs)}). Is this correct?`,
    });
  }

  if (startMs > now.getTime() || endMs > now.getTime()) {
    warnings.push({
      code: "FUTURE",
      message: "This entry is in the future.",
    });
  }

  const candidateKeys = new Set(
    editingEntry === null
      ? []
      : [`${editingEntry.id}-${editingEntry.createdAt}`],
  );

  const overlapMatches = knownEntries.filter((entry) => {
    if (candidateKeys.has(`${entry.id}-${entry.createdAt}`)) {
      return false;
    }

    const entryStart = parseTimestamp(entry.start);
    const entryEnd = parseTimestamp(entry.end);

    if (entryStart === null || entryEnd === null) {
      return false;
    }

    return entryStart < endMs && startMs < entryEnd;
  });

  if (overlapMatches.length > 0) {
    const visible = overlapMatches.slice(0, 3);

    for (const entry of visible) {
      warnings.push({
        code: "OVERLAP",
        message: `This overlaps entry #${entry.id} (${formatOverlapText(entry)}).`,
      });
    }
  }

  return warnings;
}
