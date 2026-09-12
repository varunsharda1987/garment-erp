/**
 * AI Insights Routes (ADMIN)
 *
 * What the assistant could not answer, weak guide matches, thumbs-down answers by guide,
 * and guide usage — so the owner knows which guides to write or fix next. Read-only.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateQuery } from '../middleware/validation.middleware';
import { aiInsightsService, resolveRange } from '../services/ai/ai-insights.service';
import { aiInsightsQuerySchema, type AiInsightsQueryInput } from '../schemas/aiInsights.schema';

const router = Router();

// authorize('ADMIN') is a no-op in full-access mode — gate inline like ai-admin.routes.ts
router.use(authenticateToken);
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
  }
  next();
});

function readQuery(req: Request): AiInsightsQueryInput {
  return ((req as Request & { validatedQuery?: unknown }).validatedQuery ?? {}) as AiInsightsQueryInput;
}

/** GET /api/ai-insights/summary */
router.get(
  '/summary',
  validateQuery(aiInsightsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = readQuery(req);
    res.json(await aiInsightsService.getSummary(resolveRange(query.from, query.to)));
  })
);

/** GET /api/ai-insights/unanswered — questions no guide matched, grouped, most frequent first */
router.get(
  '/unanswered',
  validateQuery(aiInsightsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = readQuery(req);
    const data = await aiInsightsService.getUnanswered(resolveRange(query.from, query.to), {
      includeData: query.includeData === 'true',
      limit: query.limit,
    });
    res.json({ data });
  })
);

/** GET /api/ai-insights/weak — a guide matched, but only barely (keyword score 1-2) */
router.get(
  '/weak',
  validateQuery(aiInsightsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = readQuery(req);
    const data = await aiInsightsService.getWeakMatches(resolveRange(query.from, query.to), { limit: query.limit });
    res.json({ data });
  })
);

/** GET /api/ai-insights/negative-feedback — thumbs-down answers with the guide that produced them */
router.get(
  '/negative-feedback',
  validateQuery(aiInsightsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = readQuery(req);
    const data = await aiInsightsService.getNegativeFeedback(resolveRange(query.from, query.to), {
      limit: query.limit,
    });
    res.json({ data });
  })
);

/** GET /api/ai-insights/guide-usage — how often each guide answered, and how it was rated */
router.get(
  '/guide-usage',
  validateQuery(aiInsightsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = readQuery(req);
    const data = await aiInsightsService.getGuideUsage(resolveRange(query.from, query.to));
    res.json({ data });
  })
);

export default router;
