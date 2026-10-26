import { describe, expect, it } from "vitest";
import {
  sanitizeClient,
  sanitizeEntry,
  sanitizeList,
  sanitizeProject,
  sanitizeTask,
} from "../lib/sanitize.js";

describe("sanitize", () => {
  it("keeps only client fields", () => {
    expect(
      sanitizeClient({
        id: 1,
        name: "Acme",
        description: "Client",
        status: "active",
        createdAt: "2025-01-01",
        updatedAt: "2025-01-02",
        userId: "secret",
        extra: true,
      }),
    ).toEqual({
      id: 1,
      name: "Acme",
      description: "Client",
      status: "active",
      createdAt: "2025-01-01",
      updatedAt: "2025-01-02",
    });
  });

  it("keeps only project fields", () => {
    expect(
      sanitizeProject({
        id: 2,
        clientId: 1,
        name: "Project",
        status: "pending",
        createdAt: "2025-01-01",
        updatedAt: "2025-01-02",
        userId: "secret",
      }),
    ).toEqual({
      id: 2,
      clientId: 1,
      name: "Project",
      status: "pending",
      createdAt: "2025-01-01",
      updatedAt: "2025-01-02",
    });
  });

  it("keeps only task fields", () => {
    expect(
      sanitizeTask({
        id: 3,
        projectId: 2,
        name: "Task",
        status: "in-progress",
        createdAt: "2025-01-01",
        updatedAt: "2025-01-02",
        parent: 99,
      }),
    ).toEqual({
      id: 3,
      projectId: 2,
      name: "Task",
      status: "in-progress",
      createdAt: "2025-01-01",
      updatedAt: "2025-01-02",
    });
  });

  it("drops userId from entries", () => {
    const entry = sanitizeEntry({
      id: 0,
      taskId: 3,
      comment: "Work",
      start: "2025-01-01T09:00:00.000Z",
      end: "2025-01-01T10:00:00.000Z",
      createdAt: "2025-01-01T10:00:00.000Z",
      updatedAt: "2025-01-01T10:00:00.000Z",
      userId: "secret-key",
    });

    expect(entry).not.toHaveProperty("userId");
    expect(JSON.stringify(entry)).not.toContain("secret-key");
  });

  it("sanitizes arrays", () => {
    expect(
      sanitizeList([{ id: 1, name: "Acme", userId: "secret" }], sanitizeClient),
    ).toEqual([{ id: 1, name: "Acme" }]);
  });
});
