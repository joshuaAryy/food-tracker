import { Router } from 'express';
import { mockId, mockTimestamp, mockWeightLogs } from '../../lib/mock-data.js';
import { sendSuccess } from '../../lib/responses.js';

export const weightLogsRouter = Router();

weightLogsRouter.get('/', (_request, response) =>
  sendSuccess(response, { weightLogs: mockWeightLogs }),
);
weightLogsRouter.post('/', (_request, response) =>
  sendSuccess(response, {
    id: mockId('weight-log'),
    weightLb: 180,
    loggedAt: mockTimestamp(),
    createdAt: mockTimestamp(),
    updatedAt: mockTimestamp(),
  }),
);
weightLogsRouter.put('/:id', (_request, response) =>
  sendSuccess(response, {
    id: mockId('weight-log'),
    weightLb: 180,
    loggedAt: mockTimestamp(),
    createdAt: mockTimestamp(),
    updatedAt: mockTimestamp(),
  }),
);
weightLogsRouter.delete('/:id', (request, response) =>
  sendSuccess(response, { id: request.params.id, deleted: true }),
);
