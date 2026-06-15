import { Router } from 'express';
import { mockGoals } from '../../lib/mock-data.js';
import { sendSuccess } from '../../lib/responses.js';

export const goalsRouter = Router();

goalsRouter.get('/', (_request, response) => sendSuccess(response, mockGoals));
goalsRouter.put('/', (_request, response) => sendSuccess(response, mockGoals));
