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
import { recipesRouter } from '../modules/recipes/routes.js';
import { setupRouter } from '../modules/setup/routes.js';
import { trackingPreferencesRouter } from '../modules/trackingPreferences/routes.js';
import { usersRouter } from '../modules/users/routes.js';
import { weightLogsRouter } from '../modules/weightLogs/routes.js';

export const apiRouter = Router();

apiRouter.use('/profile', usersRouter);
apiRouter.use('/goals', goalsRouter);
apiRouter.use('/tracking-preferences', trackingPreferencesRouter);
apiRouter.use('/setup', setupRouter);
apiRouter.use('/food-items', foodItemsRouter);
apiRouter.use('/food-logs', foodLogsRouter);
apiRouter.use('/recipes', recipesRouter);
apiRouter.use('/weight-logs', weightLogsRouter);
apiRouter.use('/dashboard', analyticsRouter);
apiRouter.use('/analytics', advancedAnalyticsRouter);
apiRouter.use('/recommendations', recommendationsRouter);
apiRouter.use('/ai', aiRouter);
