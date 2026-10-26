import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api";
import {
  ApiRequestError,
  request,
} from "../src/api/http";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("request", () => {
  it("returns parsed JSON and sends query params", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([{ id: 0 }], 200),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await request<{ id: number }[]>("/clients", {
      query: { limit: 10, offset: 0 },
    });

    expect(result).toEqual([{ id: 0 }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/clients?limit=10&offset=0",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws a typed error for non-429 failures without retrying", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          message: "End time must be after the start time.",
          code: "BAD_REQUEST",
        },
        400,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await request("/time-entries").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      message: "End time must be after the start time.",
      code: "BAD_REQUEST",
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("waits out a 429 and retries the request", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: "Too many requests.",
            code: "RATE_LIMITED",
            retryAfterSeconds: 1,
          },
          429,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 7 }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const pending = request<{ id: number }>("/tasks/7");

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toEqual({ id: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps fetch failures to NETWORK_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const error = await request("/clients").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      code: "NETWORK_ERROR",
      status: 0,
      message: "Can't reach the server. Please try again.",
    });
  });

  it("blocks update and delete for entry ID 0", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      taskId: 1,
      comment: "Work",
      start: "2025-11-01T10:00:00.000Z",
      end: "2025-11-01T11:00:00.000Z",
    };

    await expect(api.entries.update(0, input)).rejects.toMatchObject({
      code: "ENTRY_ID_LOCKED",
    });
    await expect(api.entries.remove(0)).rejects.toMatchObject({
      code: "ENTRY_ID_LOCKED",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
