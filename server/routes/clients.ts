import { Router } from "express";
import { cacheKey, referenceCache } from "../lib/cache.js";
import { sanitizeClient, sanitizeList, sanitizeProject } from "../lib/sanitize.js";
import { upstream } from "../lib/upstream.js";
import {
  type ListQuery,
  validateIdParam,
  validateListQuery,
} from "../middleware/validate.js";

const router = Router();

router.get("/", validateListQuery, async (_req, res) => {
  const query = res.locals.query as ListQuery;
  const data = await referenceCache.getOrLoad(
    cacheKey("/clients", query),
    () =>
      upstream({
        method: "GET",
        path: "/clients",
        query: { limit: query.limit, offset: query.offset },
      }),
  );

  res.json(sanitizeList(data, sanitizeClient));
});

router.get("/:id", validateIdParam, async (_req, res) => {
  const id = res.locals.id as number;
  const data = await referenceCache.getOrLoad(cacheKey(`/clients/${id}`), () =>
    upstream({ method: "GET", path: `/clients/${id}` }),
  );

  res.json(sanitizeClient(data));
});

router.get(
  "/:id/projects",
  validateIdParam,
  validateListQuery,
  async (_req, res) => {
    const id = res.locals.id as number;
    const query = res.locals.query as ListQuery;
    const upstreamQuery = { limit: query.limit, offset: query.offset };
    const data = await referenceCache.getOrLoad(
      cacheKey(`/clients/${id}/projects`, upstreamQuery),
      () =>
        upstream({
          method: "GET",
          path: `/clients/${id}/projects`,
          query: upstreamQuery,
        }),
    );

    res.json(sanitizeList(data, sanitizeProject));
  },
);

export default router;
