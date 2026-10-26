const CLIENT_FIELDS = [
  "id",
  "name",
  "description",
  "status",
  "createdAt",
  "updatedAt",
] as const;

const PROJECT_FIELDS = [
  "id",
  "clientId",
  "name",
  "status",
  "createdAt",
  "updatedAt",
] as const;

const TASK_FIELDS = [
  "id",
  "projectId",
  "name",
  "status",
  "createdAt",
  "updatedAt",
] as const;

const ENTRY_FIELDS = [
  "id",
  "taskId",
  "comment",
  "start",
  "end",
  "createdAt",
  "updatedAt",
] as const;

export type Sanitized<T extends readonly string[]> = Partial<
  Record<T[number], unknown>
>;

function pick<T extends readonly string[]>(
  value: unknown,
  fields: T,
): Sanitized<T> {
  const source =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field];
    }
  }

  return result as Sanitized<T>;
}

export function sanitizeClient(value: unknown): Sanitized<typeof CLIENT_FIELDS> {
  return pick(value, CLIENT_FIELDS);
}

export function sanitizeProject(
  value: unknown,
): Sanitized<typeof PROJECT_FIELDS> {
  return pick(value, PROJECT_FIELDS);
}

export function sanitizeTask(value: unknown): Sanitized<typeof TASK_FIELDS> {
  return pick(value, TASK_FIELDS);
}

export function sanitizeEntry(value: unknown): Sanitized<typeof ENTRY_FIELDS> {
  return pick(value, ENTRY_FIELDS);
}

export function sanitizeList<T>(
  value: unknown,
  sanitizeItem: (item: unknown) => T,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(sanitizeItem);
}
