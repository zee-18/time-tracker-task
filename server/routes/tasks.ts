import { Router } from "express";
import { cacheKey, referenceCache } from "../lib/cache.js";
import { sanitizeTask } from "../lib/sanitize.js";
import { upstream } from "../lib/upstream.js";
import { validateIdParam } from "../middleware/validate.js";

const router = Router();

router.get("/:id", validateIdParam, async (_req, res) => {
  const id = res.locals.id as number;
  const data = await referenceCache.getOrLoad(cacheKey(`/tasks/${id}`), () =>
    upstream({ method: "GET", path: `/tasks/${id}` }),
  );

  res.json(sanitizeTask(data));
});

export default router;
