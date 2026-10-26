type LogLevel = "info" | "warn" | "error";

function normalizeData(data: unknown): Record<string, unknown> {
  if (data === undefined) {
    return {};
  }

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }

  return { data };
}

export function log(
  level: LogLevel,
  message: string,
  data?: unknown,
): void {
  const payload: Record<string, unknown> = {
    time: new Date().toISOString(),
    level,
    message,
  };

  if (data !== undefined) {
    Object.assign(payload, normalizeData(data));
  }

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info: (message: string, data?: unknown) => log("info", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
};

export default log;
