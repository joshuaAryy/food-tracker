import { Router } from 'express';
import {
  progressResponseSchema,
  reportQuerySchema,
  reportsResponseSchema,
  type ReportQuery,
} from '@food-tracker/shared';
import { currentUserId } from '../../../lib/auth.js';
import { sendSuccess } from '../../../lib/responses.js';
import { validateQuery, validatedQuery } from '../../../middleware/validate.js';
import { computeProgress, computeReports } from './service.js';

export const reportingRouter = Router();

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
    const data = await computeReports(
      currentUserId(response),
      query.period,
      query.date,
    );
    sendSuccess(response, reportsResponseSchema.parse(data));
  },
);
