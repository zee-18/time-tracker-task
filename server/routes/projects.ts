import { Router } from "express";
import { cacheKey, referenceCache } from "../lib/cache.js";
import { sanitizeList, sanitizeProject, sanitizeTask } from "../lib/sanitize.js";
import { upstream } from "../lib/upstream.js";
import {
  type ListQuery,
  validateIdParam,
  validateListQuery,
} from "../middleware/validate.js";

const router = Router();

router.get("/:id", validateIdParam, async (_req, res) => {
  const id = res.locals.id as number;
  const data = await referenceCache.getOrLoad(cacheKey(`/projects/${id}`), () =>
    upstream({ method: "GET", path: `/projects/${id}` }),
  );

  res.json(sanitizeProject(data));
});

router.get(
  "/:id/tasks",
  validateIdParam,
  validateListQuery,
  async (_req, res) => {
    const id = res.locals.id as number;
    const query = res.locals.query as ListQuery;
    const upstreamQuery = { limit: query.limit, offset: query.offset };
    const data = await referenceCache.getOrLoad(
      cacheKey(`/projects/${id}/tasks`, upstreamQuery),
      () =>
        upstream({
          method: "GET",
          path: `/projects/${id}/tasks`,
          query: upstreamQuery,
        }),
    );

    res.json(sanitizeList(data, sanitizeTask));
  },
);

export default router;
