import { Router } from 'express';
import { mockDashboardSummary } from '../../lib/mock-data.js';
import { sendSuccess } from '../../lib/responses.js';

export const analyticsRouter = Router();

analyticsRouter.get('/summary', (_request, response) =>
  sendSuccess(response, mockDashboardSummary),
);
