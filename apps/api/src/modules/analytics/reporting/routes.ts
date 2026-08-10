import { Router } from 'express';
import {
  progressResponseSchema,
  reportQuerySchema,
  reportsResponseSchema,
  streakCalendarQuerySchema,
  streakCalendarResponseSchema,
  type ReportQuery,
  type StreakCalendarQuery,
} from '@food-tracker/shared';
import { currentUserId } from '../../../lib/auth.js';
import { sendSuccess } from '../../../lib/responses.js';
import { validateQuery, validatedQuery } from '../../../middleware/validate.js';
import { computeProgress, computeReports } from './service.js';
import { computeStreakCalendar } from './calendar-service.js';
import {
  parseReportsWithDiagnostics,
  runReportsComputeWithDiagnostics,
  sendReportsWithDiagnostics,
} from './route-diagnostics.js';

export const reportingRouter = Router();

reportingRouter.get(
  '/streak-calendar',
  validateQuery(streakCalendarQuerySchema),
  async (_request, response) => {
    const query = validatedQuery<StreakCalendarQuery>(response);
    const data = await computeStreakCalendar(
      currentUserId(response),
      query.month,
    );
    sendSuccess(response, streakCalendarResponseSchema.parse(data));
  },
);

reportingRouter.get(
  '/progress',
  validateQuery(reportQuerySchema.pick({ date: true })),
  async (_request, response) => {
    const query = validatedQuery<Pick<ReportQuery, 'date'>>(response);
    const data = await computeProgress(currentUserId(response), query.date);
    sendSuccess(response, progressResponseSchema.parse(data));
  },
);

reportingRouter.get(
  '/reports',
  validateQuery(reportQuerySchema),
  async (_request, response) => {
    const query = validatedQuery<ReportQuery>(response);
    const requestId = response.locals.requestId as string | undefined;
    const data = await runReportsComputeWithDiagnostics(
      () => computeReports(currentUserId(response), query.period, query.date),
      requestId,
    );
    const parsed = parseReportsWithDiagnostics(
      () => reportsResponseSchema.parse(data),
      requestId,
    );
    sendReportsWithDiagnostics(() => sendSuccess(response, parsed), requestId);
  },
);
