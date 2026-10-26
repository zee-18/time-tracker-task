import path from "node:path";
import type { Server } from "node:http";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import clientsRouter from "./routes/clients.js";
import entriesRouter from "./routes/entries.js";
import projectsRouter from "./routes/projects.js";
import tasksRouter from "./routes/tasks.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { assertUpstreamConfigured } from "./lib/upstream.js";
import log from "./src/logger.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  const startedAt = performance.now();

  res.on("finish", () => {
    if (req.path === "/api/health") {
      return;
    }

    const durationMs = Math.round(performance.now() - startedAt);
    log("info", "request completed", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
    });
  });

  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/clients", clientsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/time-entries", entriesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

function readPort(): number {
  const raw = process.env.PORT;

  if (raw === undefined || raw.trim() === "") {
    return 3001;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    return 3001;
  }

  return port;
}

function setupShutdown(server: Server): void {
  const shutdown = (signal: string): void => {
    console.log(`Received ${signal}. Shutting down.`);

    server.close(() => {
      process.exit(0);
    });

    setTimeout(() => {
      process.exit(1);
    }, 10_000).unref();
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

function startServer(): void {
  dotenv.config({
    path: [
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "../.env"),
    ],
    quiet: true,
  });

  try {
    assertUpstreamConfigured();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Server configuration is invalid.",
    );
    process.exit(1);
  }

  const port = readPort();
  const server = app.listen(port, () => {
    log("info", "server started", {
      port,
      nodeEnv: process.env.NODE_ENV ?? "development",
    });
  });

  setupShutdown(server);
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
