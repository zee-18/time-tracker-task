import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../src/api/http";
import { getErrorMessage } from "../src/lib/errorMessages";

describe("getErrorMessage", () => {
  it("uses the proxy message for known error codes", () => {
    const error = new ApiRequestError(
      "This task no longer exists. Pick another task.",
      "TASK_NOT_FOUND",
      404,
    );

    expect(getErrorMessage(error)).toBe(
      "This task no longer exists. Pick another task.",
    );
  });

  it("uses the local message for network errors", () => {
    const error = new ApiRequestError(
      "ignored",
      "NETWORK_ERROR",
      0,
    );

    expect(getErrorMessage(error)).toBe(
      "Can't reach the server. Please try again.",
    );
  });

  it("also reads plain error bodies with the same shape", () => {
    expect(
      getErrorMessage({
        message: "This entry could not be found on the server.",
        code: "ENTRY_NOT_FOUND",
      }),
    ).toBe("This entry could not be found on the server.");
  });

  it("falls back for unknown codes and errors", () => {
    expect(
      getErrorMessage(
        new ApiRequestError("Nope", "UNKNOWN_CODE", 500),
      ),
    ).toBe("Something went wrong. Please try again.");

    expect(getErrorMessage(new Error("Nope"))).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
