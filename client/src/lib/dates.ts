const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const fullDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parseDate(iso: string | null | undefined): Date | null {
  if (typeof iso !== "string" || iso.trim().length === 0) {
    return null;
  }

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? null : date;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDateTime(
  iso: string | null | undefined,
): string {
  const date = parseDate(iso);

  if (date === null) {
    return "Invalid date";
  }

  const now = new Date();

  if (sameLocalDay(date, now)) {
    return `Today ${timeFormatter.format(date)}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (sameLocalDay(date, yesterday)) {
    return `Yesterday ${timeFormatter.format(date)}`;
  }

  return fullDateFormatter.format(date).replace(",", "");
}

export function formatTimeOfDay(
  timestamp: number | null | undefined,
): string {
  if (
    typeof timestamp !== "number" ||
    !Number.isFinite(timestamp)
  ) {
    return "Invalid date";
  }

  return timeFormatter.format(new Date(timestamp));
}

export function formatDuration(ms: number): string {
  const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalMinutes = Math.floor(safeMs / 60_000);
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

function formatOffset(part: string): string {
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(part);

  if (match === null) {
    return part === "GMT" ? "UTC+0" : part.replace("GMT", "UTC");
  }

  const sign = match[1];
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");

  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}

export function getTimezoneLabel(): string {
  try {
    const timeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(new Date());
    const offsetPart = parts.find(
      (part) => part.type === "timeZoneName",
    )?.value;

    if (offsetPart === undefined) {
      return `Times shown in ${timeZone}`;
    }

    return `Times shown in ${timeZone} (${formatOffset(offsetPart)})`;
  } catch {
    return "Times shown in local time";
  }
}

export function formatDateTimeLocal(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join("T");
}

export function isoToDateTimeLocal(
  iso: string | null | undefined,
): string {
  const date = parseDate(iso);

  return date === null ? "" : formatDateTimeLocal(date);
}

export function dateTimeLocalToIso(value: string): string | null {
  if (value.trim().length === 0) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}
