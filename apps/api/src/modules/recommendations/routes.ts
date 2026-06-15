import { Router } from 'express';
import { mockRecommendations } from '../../lib/mock-data.js';
import { sendSuccess } from '../../lib/responses.js';

export const recommendationsRouter = Router();

recommendationsRouter.get('/', (_request, response) =>
  sendSuccess(response, { recommendations: mockRecommendations }),
);
recommendationsRouter.post('/generate', (_request, response) =>
  sendSuccess(response, { recommendations: mockRecommendations }),
);
recommendationsRouter.patch('/:id/dismiss', (request, response) =>
  sendSuccess(response, {
    id: request.params.id,
    type: 'mock',
    severity: 'low',
    title: 'Mock recommendation',
    message: 'Placeholder response only.',
    sourceFacts: {},
    status: 'dismissed',
    createdAt: '2026-06-14T12:00:00.000Z',
  }),
);
