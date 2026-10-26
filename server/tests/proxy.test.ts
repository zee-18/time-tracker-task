import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index.js";
import { referenceCache } from "../lib/cache.js";
import { upstreamQueue } from "../middleware/rateQueue.js";

const API_KEY = "test-api-key";
const BASE_URL = "https://upstream.test/api/v1";

const validEntryBody = {
  taskId: 5,
  comment: "  What I worked on  ",
  start: "2025-11-03T10:00:00+02:00",
  end: "2025-11-03T09:30:00Z",
  extra: "must be dropped",
};

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function expectNoApiKey(response: {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}): void {
  expect(JSON.stringify(response.body)).not.toContain(API_KEY);
  expect(JSON.stringify(response.headers)).not.toContain(API_KEY);
}

function expectNoUserId(response: { body: unknown }): void {
  expect(JSON.stringify(response.body)).not.toContain("userId");
}

let fetchMock: ReturnType<typeof vi.fn>;

function firstCall(): { url: URL; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
  return { url, init };
}

beforeEach(() => {
  vi.stubEnv("MEMTIME_API_KEY", API_KEY);
  vi.stubEnv("MEMTIME_BASE_URL", BASE_URL);
  vi.stubEnv("UPSTREAM_TIMEOUT_MS", "1000");
  referenceCache.clear();
  upstreamQueue.reset();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("health and allowlist", () => {
  it("keeps the health route", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns our error format for unknown routes", async () => {
    const response = await request(app).get("/api/unknown").expect(404);
    expect(response.body).toEqual({
      message: "Not found.",
      code: "NOT_FOUND",
    });
    expectNoApiKey(response);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sanitizing responses", () => {
  it("removes userId and unknown entry fields", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 0,
        taskId: 5,
        comment: "Work",
        start: "2025-11-03T08:00:00.000Z",
        end: "2025-11-03T09:00:00.000Z",
        createdAt: "2025-11-03T09:00:00.000Z",
        updatedAt: "2025-11-03T09:00:00.000Z",
        userId: API_KEY,
        secret: "drop me",
      }),
    );

    const response = await request(app).get("/api/time-entries/0").expect(200);

    expect(response.body).toEqual({
      id: 0,
      taskId: 5,
      comment: "Work",
      start: "2025-11-03T08:00:00.000Z",
      end: "2025-11-03T09:00:00.000Z",
      createdAt: "2025-11-03T09:00:00.000Z",
      updatedAt: "2025-11-03T09:00:00.000Z",
    });
    expectNoApiKey(response);
    expectNoUserId(response);

    const { url, init } = firstCall();
    expect(url.toString()).toBe(`${BASE_URL}/time-entries/0`);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${API_KEY}`,
    );
  });

  it("sanitizes lists", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { id: 1, name: "Acme", userId: API_KEY, extra: true },
        { id: 2, name: "Beta", description: "Second" },
      ]),
    );

    const response = await request(app).get("/api/clients").expect(200);

    expect(response.body).toEqual([
      { id: 1, name: "Acme" },
      { id: 2, name: "Beta", description: "Second" },
    ]);
    expectNoApiKey(response);
    expectNoUserId(response);
  });

  it("removes userId from entry lists", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          id: 0,
          taskId: 5,
          comment: "Work",
          start: "2025-11-03T08:00:00.000Z",
          end: "2025-11-03T09:00:00.000Z",
          userId: API_KEY,
        },
      ]),
    );

    const response = await request(app).get("/api/time-entries").expect(200);

    expect(response.body).toEqual([
      {
        id: 0,
        taskId: 5,
        comment: "Work",
        start: "2025-11-03T08:00:00.000Z",
        end: "2025-11-03T09:00:00.000Z",
      },
    ]);
    expectNoApiKey(response);
    expectNoUserId(response);
  });

  it("removes userId from POST and PUT responses", async () => {
    const upstreamEntry = {
      id: 12,
      taskId: 5,
      comment: "What I worked on",
      start: "2025-11-03T08:00:00.000Z",
      end: "2025-11-03T09:30:00.000Z",
      userId: API_KEY,
    };

    fetchMock.mockResolvedValueOnce(jsonResponse(upstreamEntry, 201));
    const created = await request(app)
      .post("/api/time-entries")
      .send(validEntryBody)
      .expect(201);
    expectNoApiKey(created);
    expectNoUserId(created);

    fetchMock.mockResolvedValueOnce(jsonResponse({ ...upstreamEntry, id: 7 }));
    const updated = await request(app)
      .put("/api/time-entries/7")
      .send(validEntryBody)
      .expect(200);

    expect(updated.body).toEqual({
      id: 7,
      taskId: 5,
      comment: "What I worked on",
      start: "2025-11-03T08:00:00.000Z",
      end: "2025-11-03T09:30:00.000Z",
    });
    expectNoApiKey(updated);
    expectNoUserId(updated);

    const [putUrl, putInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(putUrl.toString()).toBe(`${BASE_URL}/time-entries/7`);
    expect(putInit.method).toBe("PUT");
    expect(JSON.parse(putInit.body as string)).toEqual({
      taskId: 5,
      comment: "What I worked on",
      start: "2025-11-03T08:00:00.000Z",
      end: "2025-11-03T09:30:00.000Z",
    });
  });

  it("does not expose the key in headers or logs", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ id: 1, name: "Acme", userId: API_KEY }, 200, {
          "x-upstream-secret": API_KEY,
        }),
      );

      const success = await request(app)
        .get(`/api/clients/1?key=${API_KEY}`)
        .expect(200);

      expect(success.headers["x-upstream-secret"]).toBeUndefined();
      expectNoApiKey(success);
      expectNoUserId(success);

      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: `rejected key ${API_KEY}` }, 400),
      );

      const failure = await request(app).get("/api/clients/2").expect(400);
      expectNoApiKey(failure);

      const logOutput = [...log.mock.calls, ...error.mock.calls]
        .map((call) => call.map(String).join(" "))
        .join("\n");

      expect(logOutput).not.toContain(API_KEY);
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });
});

describe("query validation", () => {
  it("clamps limit and drops unknown query params", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await request(app)
      .get("/api/clients?limit=9999&offset=5&foo=bar&sortBy=start&order=asc")
      .expect(200);

    const { url } = firstCall();
    expect(url.toString()).toBe(`${BASE_URL}/clients?limit=500&offset=5`);
  });

  it.each([
    ["0", "1"],
    ["-5", "1"],
  ])("clamps limit=%s to %s", async (rawLimit, expectedLimit) => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await request(app)
      .get(`/api/clients?limit=${encodeURIComponent(rawLimit)}`)
      .expect(200);

    const { url } = firstCall();
    expect(url.searchParams.get("limit")).toBe(expectedLimit);
  });

  it("rejects a non-numeric limit", async () => {
    const response = await request(app)
      .get("/api/clients?limit=abc")
      .expect(400);

    expect(response.body).toEqual({
      message: "limit must be a whole number.",
      code: "INVALID_QUERY",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["-5", "1.5", "abc"])(
    "rejects invalid offset=%s",
    async (offset) => {
      const response = await request(app)
        .get(`/api/clients?offset=${encodeURIComponent(offset)}`)
        .expect(400);

      expect(response.body.code).toBe("INVALID_QUERY");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("always sends an explicit sortBy and order for entries", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await request(app).get("/api/time-entries?limit=2&foo=bar").expect(200);

    const { url } = firstCall();
    expect(url.searchParams.get("limit")).toBe("2");
    expect(url.searchParams.get("offset")).toBe("0");
    expect(url.searchParams.get("sortBy")).toBe("start");
    expect(url.searchParams.get("order")).toBe("desc");
    expect(url.searchParams.has("foo")).toBe(false);
  });

  it("rejects an unknown sortBy", async () => {
    const response = await request(app)
      .get("/api/time-entries?sortBy=end")
      .expect(400);

    expect(response.body).toEqual({
      message: "Sort by must be start.",
      code: "INVALID_QUERY",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown order", async () => {
    const response = await request(app)
      .get("/api/time-entries?order=sideways")
      .expect(400);

    expect(response.body).toEqual({
      message: "Order must be asc or desc.",
      code: "INVALID_QUERY",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["abc", "-1", "1.5"])(
    "rejects invalid id=%s",
    async (id) => {
      const response = await request(app)
        .get(`/api/time-entries/${encodeURIComponent(id)}`)
        .expect(400);

      expect(response.body.code).toBe("INVALID_ID");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("entry id 0", () => {
  it("allows GET on id 0", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 0, userId: API_KEY }));

    const response = await request(app).get("/api/time-entries/0").expect(200);

    expect(response.body).toEqual({ id: 0 });
    expectNoApiKey(response);
    expectNoUserId(response);
  });

  it("blocks PUT on id 0", async () => {
    const response = await request(app)
      .put("/api/time-entries/0")
      .send(validEntryBody)
      .expect(400);

    expect(response.body).toEqual({
      message: "This entry can't be changed because of a known API issue.",
      code: "ENTRY_ID_LOCKED",
    });
    expectNoApiKey(response);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks DELETE on id 0", async () => {
    const response = await request(app)
      .delete("/api/time-entries/0")
      .expect(400);

    expect(response.body).toEqual({
      message: "This entry can't be changed because of a known API issue.",
      code: "ENTRY_ID_LOCKED",
    });
    expectNoApiKey(response);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("entry body validation", () => {
  it("normalizes dates to UTC and forwards only the four fields", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          id: 12,
          taskId: 5,
          comment: "What I worked on",
          start: "2025-11-03T08:00:00.000Z",
          end: "2025-11-03T09:30:00.000Z",
          userId: API_KEY,
        },
        201,
      ),
    );

    const response = await request(app)
      .post("/api/time-entries")
      .send(validEntryBody)
      .expect(201);

    expect(response.body).toEqual({
      id: 12,
      taskId: 5,
      comment: "What I worked on",
      start: "2025-11-03T08:00:00.000Z",
      end: "2025-11-03T09:30:00.000Z",
    });
    expect(JSON.stringify(response.body)).not.toContain(API_KEY);

    const { init } = firstCall();
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      taskId: 5,
      comment: "What I worked on",
      start: "2025-11-03T08:00:00.000Z",
      end: "2025-11-03T09:30:00.000Z",
    });
  });

  it.each(["", "   "])("rejects empty or whitespace comments", async (comment) => {
    const response = await request(app)
      .post("/api/time-entries")
      .send({ ...validEntryBody, comment })
      .expect(400);

    expect(response.body).toEqual({
      message: "Comment must be between 1 and 500 characters.",
      code: "INVALID_BODY",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects comments over 500 characters", async () => {
    const response = await request(app)
      .post("/api/time-entries")
      .send({ ...validEntryBody, comment: "a".repeat(501) })
      .expect(400);

    expect(response.body).toEqual({
      message: "Comment must be between 1 and 500 characters.",
      code: "INVALID_BODY",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["taskId", "comment", "start", "end"])(
    "rejects a missing %s field",
    async (field) => {
      const body: Record<string, unknown> = { ...validEntryBody };
      delete body[field];

      const response = await request(app)
        .post("/api/time-entries")
        .send(body)
        .expect(400);

      expect(response.body.code).toBe("INVALID_BODY");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects end before start", async () => {
    const response = await request(app)
      .post("/api/time-entries")
      .send({
        ...validEntryBody,
        start: "2025-11-03T10:00:00Z",
        end: "2025-11-03T09:00:00Z",
      })
      .expect(400);

    expect(response.body.message).toBe(
      "End time must be after the start time.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects start equal to end", async () => {
    const response = await request(app)
      .post("/api/time-entries")
      .send({
        ...validEntryBody,
        start: "2025-11-03T10:00:00Z",
        end: "2025-11-03T10:00:00Z",
      })
      .expect(400);

    expect(response.body.message).toBe(
      "End time must be after the start time.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid ISO dates and task ids", async () => {
    const badDate = await request(app)
      .post("/api/time-entries")
      .send({ ...validEntryBody, start: "2025-02-30T10:00:00Z" })
      .expect(400);
    expect(badDate.body.code).toBe("INVALID_BODY");

    const badTask = await request(app)
      .post("/api/time-entries")
      .send({ ...validEntryBody, taskId: "5" })
      .expect(400);
    expect(badTask.body.code).toBe("INVALID_BODY");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns our error format for invalid JSON", async () => {
    const response = await request(app)
      .post("/api/time-entries")
      .set("Content-Type", "application/json")
      .send('{"taskId": 5,')
      .expect(400);

    expect(response.body).toEqual({
      message: "Something went wrong with the data we sent. Please try again.",
      code: "INVALID_JSON",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("upstream errors", () => {
  it("maps 400 without forwarding upstream text", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "raw upstream detail" }, 400),
    );

    const response = await request(app).get("/api/clients/1").expect(400);

    expect(response.body).toEqual({
      message: "Something went wrong with the data we sent. Please try again.",
      code: "BAD_REQUEST",
    });
    expect(JSON.stringify(response.body)).not.toContain("raw upstream detail");
    expectNoApiKey(response);
  });

  it("uses TASK_NOT_FOUND when the upstream message mentions a task", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "Task #5 not found" }, 404),
    );

    const response = await request(app)
      .get("/api/time-entries/5")
      .expect(404);

    expect(response.body).toEqual({
      message: "This task no longer exists. Pick another task.",
      code: "TASK_NOT_FOUND",
    });
    expectNoApiKey(response);
  });

  it("uses ENTRY_NOT_FOUND for other 404s", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "Time entry removed" }, 404),
    );

    const response = await request(app)
      .get("/api/time-entries/5")
      .expect(404);

    expect(response.body).toEqual({
      message:
        "This entry could not be found on the server. It may have been removed.",
      code: "ENTRY_NOT_FOUND",
    });
    expectNoApiKey(response);
  });

  it("maps 429 with retryAfterSeconds", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "slow down" }, 429, { "retry-after": "17" }),
    );

    const response = await request(app).get("/api/clients").expect(429);

    expect(response.body).toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 17,
    });
    expect(JSON.stringify(response.body)).not.toContain("slow down");
    expectNoApiKey(response);
  });

  it("maps 5xx and network errors to 502", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

    const serverError = await request(app).get("/api/clients/1").expect(502);
    expect(serverError.body).toEqual({
      message: "Can't reach the server. Please try again.",
      code: "UPSTREAM_ERROR",
    });
    expectNoApiKey(serverError);

    fetchMock.mockRejectedValueOnce(new TypeError("network down"));

    const networkError = await request(app).get("/api/clients/2").expect(502);
    expect(networkError.body.code).toBe("UPSTREAM_ERROR");
    expectNoApiKey(networkError);
  });

  it("maps timeouts to 504", async () => {
    vi.stubEnv("UPSTREAM_TIMEOUT_MS", "5");
    fetchMock.mockImplementation(
      (_url: URL, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const response = await request(app)
      .post("/api/time-entries")
      .send(validEntryBody)
      .expect(504);

    expect(response.body).toEqual({
      message: "The server took too long to respond. Please try again.",
      code: "UPSTREAM_TIMEOUT",
    });
    expectNoApiKey(response);
  });
});

describe("caching", () => {
  it("caches reference data", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 33, name: "Cached client" }),
    );

    const first = await request(app).get("/api/clients/33").expect(200);
    const second = await request(app).get("/api/clients/33").expect(200);

    expect(first.body).toEqual({ id: 33, name: "Cached client" });
    expect(second.body).toEqual(first.body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches reference data after the TTL", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 33, name: "Cached client" }))
      .mockResolvedValueOnce(jsonResponse({ id: 33, name: "Cached client" }));

    await request(app).get("/api/clients/33").expect(200);
    await request(app).get("/api/clients/33").expect(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-01-01T00:01:01.000Z"));
    await request(app).get("/api/clients/33").expect(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shares an in-flight reference request", async () => {
    let resolveFetch: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = request(app).get("/api/tasks/9").then((response) => response);
    const second = request(app).get("/api/tasks/9").then((response) => response);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveFetch(jsonResponse({ id: 9, name: "Task" }));

    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(firstResponse.body).toEqual({ id: 9, name: "Task" });
    expect(secondResponse.body).toEqual({ id: 9, name: "Task" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache errors", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ id: 1, name: "Acme" }));

    await request(app).get("/api/clients/1").expect(502);
    await request(app).get("/api/clients/1").expect(200);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never caches time entries", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ id: 1 }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 2 }]));

    await request(app).get("/api/time-entries").expect(200);
    await request(app).get("/api/time-entries").expect(200);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
