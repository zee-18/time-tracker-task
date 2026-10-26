import { isApiError } from "../../api/http";
import type { Entry, EntryInput } from "../../api/types";
import {
  dateTimeLocalToIso,
  formatDateTimeLocal,
  isoToDateTimeLocal,
} from "../../lib/dates";
import { getErrorMessage } from "../../lib/errorMessages";
import { getDefaultTimes, isSmartStartUsed } from "../../lib/smartDefaults";
import { getTaskPath, type TaskPath } from "../tree/selection";
import type { OpenDrawerState } from "./drawerStore";
import type { SaveErrorState } from "./EntryFormFeedback";

export interface EntryFormInitial {
  taskId: number | null;
  taskPath: TaskPath | null;
  comment: string;
  start: string;
  end: string;
  originalStartIso: string | null;
  originalEndIso: string | null;
  smartStart: boolean;
}

export function createEntryFormInitial(
  drawer: OpenDrawerState,
  knownEntries: Entry[] = [],
): EntryFormInitial {
  if (drawer.mode === "edit") {
    const { entry } = drawer;

    return {
      taskId: entry.taskId,
      taskPath: getTaskPath(entry.taskId) ?? null,
      comment: entry.comment,
      start: isoToDateTimeLocal(entry.start),
      end: isoToDateTimeLocal(entry.end),
      originalStartIso: entry.start,
      originalEndIso: entry.end,
      smartStart: false,
    };
  }

  const now = new Date();
  const defaults = getDefaultTimes(knownEntries, now);
  const smartStart = isSmartStartUsed(
    knownEntries,
    now,
    defaults.start,
    defaults.end,
  );

  return {
    taskId: drawer.task.task.id,
    taskPath: drawer.task,
    comment: "",
    start: formatDateTimeLocal(defaults.start),
    end: formatDateTimeLocal(defaults.end),
    originalStartIso: null,
    originalEndIso: null,
    smartStart,
  };
}

interface BuildEntryInputOptions {
  mode: OpenDrawerState["mode"];
  taskId: number | null;
  comment: string;
  start: string;
  end: string;
  initial: EntryFormInitial;
}

export function buildEntryInput({
  mode,
  taskId,
  comment,
  start,
  end,
  initial,
}: BuildEntryInputOptions): EntryInput | null {
  if (taskId === null) {
    return null;
  }

  const startIso =
    mode === "edit" && start === initial.start
      ? initial.originalStartIso
      : dateTimeLocalToIso(start);
  const endIso =
    mode === "edit" && end === initial.end
      ? initial.originalEndIso
      : dateTimeLocalToIso(end);

  if (startIso === null || endIso === null) {
    return null;
  }

  return {
    taskId,
    comment: comment.trim(),
    start: startIso,
    end: endIso,
  };
}

export function formatTaskPath(taskPath: TaskPath): string {
  return `${taskPath.client.name} > ${taskPath.project.name} > ${taskPath.task.name}`;
}

const NETWORK_CODES = new Set([
  "NETWORK_ERROR",
  "UPSTREAM_ERROR",
  "UPSTREAM_TIMEOUT",
]);

export function getApiErrorCode(error: unknown): string | null {
  return isApiError(error) ? error.code : null;
}

export function classifySaveError(
  error: unknown,
  saveKind: "create" | "update",
): SaveErrorState {
  const code = getApiErrorCode(error);
  const status = isApiError(error) ? error.status : null;

  if (code === "TASK_NOT_FOUND") {
    return {
      kind: "task-not-found",
      message:
        "This task no longer exists. Close this form and select another task.",
    };
  }

  if (code === "ENTRY_NOT_FOUND" && saveKind === "update") {
    return {
      kind: "entry-not-found",
      message:
        "This entry could not be found on the server. It may have been removed.",
    };
  }

  if (
    code === "BAD_REQUEST" ||
    (status === 400 && code !== "ENTRY_ID_LOCKED")
  ) {
    return {
      kind: "bad-request",
      message: getErrorMessage(error),
    };
  }

  if (code !== null && NETWORK_CODES.has(code)) {
    return {
      kind: "network",
      message: "Can't reach the server. Your entry is kept.",
    };
  }

  if (code === "RATE_LIMITED") {
    return {
      kind: "rate-limited",
      message: getErrorMessage(error),
    };
  }

  return {
    kind: "generic",
    message: getErrorMessage(error),
  };
}

export function classifyDeleteError(
  error: unknown,
): SaveErrorState {
  const code = getApiErrorCode(error);
  const status = isApiError(error) ? error.status : null;

  if (code === "ENTRY_NOT_FOUND") {
    return {
      kind: "entry-not-found",
      message:
        "This entry could not be found on the server. It may have been removed.",
    };
  }

  if (
    code === "BAD_REQUEST" ||
    (status === 400 && code !== "ENTRY_ID_LOCKED")
  ) {
    return {
      kind: "bad-request",
      message: getErrorMessage(error),
    };
  }

  if (code !== null && NETWORK_CODES.has(code)) {
    return {
      kind: "network",
      message: "Can't reach the server. Please try again.",
    };
  }

  if (code === "RATE_LIMITED") {
    return {
      kind: "rate-limited",
      message: getErrorMessage(error),
    };
  }

  return {
    kind: "generic",
    message: getErrorMessage(error),
  };
}

export function savedEntryLabel(
  entry: Entry,
  taskPath: TaskPath | null,
): string {
  const path =
    taskPath !== null && taskPath.task.id === entry.taskId
      ? taskPath
      : getTaskPath(entry.taskId);

  return path === undefined || path === null
    ? `Task #${entry.taskId}`
    : formatTaskPath(path);
}
