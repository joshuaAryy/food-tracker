import { Router } from 'express';
import { mockProfile } from '../../lib/mock-data.js';
import { sendSuccess } from '../../lib/responses.js';

export const usersRouter = Router();

usersRouter.get('/', (_request, response) =>
  sendSuccess(response, mockProfile),
);
usersRouter.put('/', (_request, response) =>
  sendSuccess(response, mockProfile),
);
