import {
  NETWORK_ERROR_CODE,
  NETWORK_ERROR_MESSAGE,
  isApiError,
} from "../api/http";
import { API_ERROR_CODES } from "../api/types";

const KNOWN_ERROR_CODES = new Set<string>(API_ERROR_CODES);
const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

interface ErrorDetails {
  message: string;
  code: string;
}

function readErrorDetails(error: unknown): ErrorDetails | null {
  if (isApiError(error)) {
    return error;
  }

  if (typeof error !== "object" || error === null) {
    return null;
  }

  const candidate = error as {
    message?: unknown;
    code?: unknown;
  };

  if (
    typeof candidate.message === "string" &&
    typeof candidate.code === "string"
  ) {
    return {
      message: candidate.message,
      code: candidate.code,
    };
  }

  return null;
}

export function getErrorMessage(error: unknown): string {
  const details = readErrorDetails(error);

  if (details !== null) {
    if (details.code === NETWORK_ERROR_CODE) {
      return NETWORK_ERROR_MESSAGE;
    }

    if (
      KNOWN_ERROR_CODES.has(details.code) &&
      details.message.trim().length > 0
    ) {
      return details.message;
    }
  }

  return FALLBACK_MESSAGE;
}
