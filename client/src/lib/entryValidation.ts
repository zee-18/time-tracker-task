export const COMMENT_MAX_LENGTH = 500;

export interface EntryFormValues {
  taskId: number | null;
  comment: string;
  start: string;
  end: string;
}

export type EntryField = keyof EntryFormValues;
export type EntryErrors = Partial<Record<EntryField, string>>;

export const ENTRY_FIELD_ORDER: EntryField[] = [
  "taskId",
  "comment",
  "start",
  "end",
];

export const ENTRY_ERROR_MESSAGES = {
  task: "Choose a task.",
  commentRequired: "Enter a comment.",
  commentTooLong: "Comment must be 500 characters or fewer.",
  date: "Enter a valid date and time.",
  endBeforeStart: "End time must be after the start time.",
} as const;

function dateTimeLocalTimestamp(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getEntryDurationMs(
  start: string,
  end: string,
): number | null {
  const startMs = dateTimeLocalTimestamp(start);
  const endMs = dateTimeLocalTimestamp(end);

  if (startMs === null || endMs === null || endMs <= startMs) {
    return null;
  }

  return endMs - startMs;
}

export function validateEntryForm(
  values: EntryFormValues,
): EntryErrors {
  const errors: EntryErrors = {};
  const comment = values.comment.trim();

  if (values.taskId === null) {
    errors.taskId = ENTRY_ERROR_MESSAGES.task;
  }

  if (comment.length === 0) {
    errors.comment = ENTRY_ERROR_MESSAGES.commentRequired;
  } else if (comment.length > COMMENT_MAX_LENGTH) {
    errors.comment = ENTRY_ERROR_MESSAGES.commentTooLong;
  }

  const startMs = dateTimeLocalTimestamp(values.start);
  const endMs = dateTimeLocalTimestamp(values.end);

  if (startMs === null) {
    errors.start = ENTRY_ERROR_MESSAGES.date;
  }

  if (endMs === null) {
    errors.end = ENTRY_ERROR_MESSAGES.date;
  } else if (startMs !== null && endMs <= startMs) {
    errors.end = ENTRY_ERROR_MESSAGES.endBeforeStart;
  }

  return errors;
}
