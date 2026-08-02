import type { RequestHandler } from 'express';
import request from 'supertest';
import { expect } from 'vitest';
import { MOCK_USER_ID } from '@food-tracker/shared';
import { createApp } from '../../src/app.js';

const deterministicTestAuth: RequestHandler = (_request, response, next) => {
  response.locals.userId = MOCK_USER_ID;
  next();
};

export const api = request(createApp(deterministicTestAuth));

export function expectSuccessEnvelope(body: unknown): asserts body is {
  success: true;
  data: unknown;
} {
  expect(body).toMatchObject({ success: true });
  expect(body).toHaveProperty('data');
}

export function expectErrorEnvelope(
  body: unknown,
  code: string,
): asserts body is {
  success: false;
  error: { code: string; message: string; details: unknown };
} {
  expect(body).toMatchObject({
    success: false,
    error: {
      code,
      message: expect.any(String),
      details: expect.any(Object),
    },
  });
}
