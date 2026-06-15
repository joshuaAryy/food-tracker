import { Router } from 'express';
import { mockFoodLogs, mockId, mockTimestamp } from '../../lib/mock-data.js';
import { sendSuccess } from '../../lib/responses.js';

export const foodLogsRouter = Router();

foodLogsRouter.get('/', (_request, response) =>
  sendSuccess(response, { foodLogs: mockFoodLogs }),
);
foodLogsRouter.post('/', (_request, response) =>
  sendSuccess(response, {
    id: mockId('food-log'),
    foodName: 'Mock food',
    mealType: 'other',
    calories: 0,
    protein: 0,
    carbs: null,
    fat: null,
    fiber: null,
    sugar: null,
    sodium: null,
    notes: null,
    servingQuantity: null,
    servingUnit: null,
    loggedAt: mockTimestamp(),
    createdAt: mockTimestamp(),
    updatedAt: mockTimestamp(),
  }),
);
foodLogsRouter.put('/:id', (_request, response) =>
  sendSuccess(response, {
    id: mockId('food-log'),
    foodName: 'Mock food',
    mealType: 'other',
    calories: 0,
    protein: 0,
    carbs: null,
    fat: null,
    fiber: null,
    sugar: null,
    sodium: null,
    notes: null,
    servingQuantity: null,
    servingUnit: null,
    loggedAt: mockTimestamp(),
    createdAt: mockTimestamp(),
    updatedAt: mockTimestamp(),
  }),
);
foodLogsRouter.delete('/:id', (request, response) =>
  sendSuccess(response, { id: request.params.id, deleted: true }),
);
