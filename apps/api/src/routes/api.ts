import { Router } from 'express';
import {
  advancedAnalyticsRouter,
  analyticsRouter,
} from '../modules/analytics/routes.js';
import { aiRouter } from '../modules/ai/routes.js';
import { foodItemsRouter } from '../modules/foodItems/routes.js';
import { foodLogsRouter } from '../modules/foodLogs/routes.js';
import { goalsRouter } from '../modules/goals/routes.js';
import { recommendationsRouter } from '../modules/recommendations/routes.js';
import { reportingRouter } from '../modules/analytics/reporting/routes.js';
import {
  insightsRouter,
  trendsRouter,
} from '../modules/analytics/trends/routes.js';
import {
  analyticsPreferencesRouter,
  analyticsSavedViewsRouter,
} from '../modules/analytics/savedViews/routes.js';
import { recipesRouter } from '../modules/recipes/routes.js';
import { setupRouter } from '../modules/setup/routes.js';
import { trackingPreferencesRouter } from '../modules/trackingPreferences/routes.js';
import { usersRouter } from '../modules/users/routes.js';
import { weightLogsRouter } from '../modules/weightLogs/routes.js';
import { waterLogsRouter } from '../modules/waterLogs/routes.js';

export const apiRouter = Router();

apiRouter.use('/profile', usersRouter);
apiRouter.use('/goals', goalsRouter);
apiRouter.use('/tracking-preferences', trackingPreferencesRouter);
apiRouter.use('/setup', setupRouter);
apiRouter.use('/food-items', foodItemsRouter);
apiRouter.use('/food-logs', foodLogsRouter);
apiRouter.use('/recipes', recipesRouter);
apiRouter.use('/weight-logs', weightLogsRouter);
apiRouter.use('/water-logs', waterLogsRouter);
apiRouter.use('/dashboard', analyticsRouter);
apiRouter.use('/analytics', advancedAnalyticsRouter);
apiRouter.use('/analytics', reportingRouter);
apiRouter.use('/analytics/trends', trendsRouter);
apiRouter.use('/analytics/insights', insightsRouter);
apiRouter.use('/analytics/preferences', analyticsPreferencesRouter);
apiRouter.use('/analytics/saved-views', analyticsSavedViewsRouter);
apiRouter.use('/recommendations', recommendationsRouter);
apiRouter.use('/ai', aiRouter);
