import { Router } from "express";
import { sanitizeEntry, sanitizeList } from "../lib/sanitize.js";
import { upstream } from "../lib/upstream.js";
import {
  type EntriesQuery,
  type EntryBody,
  validateEntriesQuery,
  validateEntryBody,
  validateIdParam,
  validateMutableEntryId,
} from "../middleware/validate.js";

const router = Router();

router.get("/", validateEntriesQuery, async (_req, res) => {
  const query = res.locals.query as EntriesQuery;
  const data = await upstream({
    method: "GET",
    path: "/time-entries",
    query: {
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sortBy,
      order: query.order,
    },
  });

  res.json(sanitizeList(data, sanitizeEntry));
});

router.get("/:id", validateIdParam, async (_req, res) => {
  const id = res.locals.id as number;
  const data = await upstream({
    method: "GET",
    path: `/time-entries/${id}`,
  });

  res.json(sanitizeEntry(data));
});

router.post("/", validateEntryBody, async (_req, res) => {
  const body = res.locals.entryBody as EntryBody;
  const data = await upstream({
    method: "POST",
    path: "/time-entries",
    body,
  });

  res.status(201).json(sanitizeEntry(data));
});

router.put("/:id", validateMutableEntryId, validateEntryBody, async (_req, res) => {
  const id = res.locals.id as number;
  const body = res.locals.entryBody as EntryBody;
  const data = await upstream({
    method: "PUT",
    path: `/time-entries/${id}`,
    body,
  });

  res.json(sanitizeEntry(data));
});

router.delete("/:id", validateMutableEntryId, async (_req, res) => {
  const id = res.locals.id as number;
  await upstream({
    method: "DELETE",
    path: `/time-entries/${id}`,
  });

  res.json({ ok: true });
});

export default router;
