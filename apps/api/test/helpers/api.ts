import request from 'supertest';
import { expect } from 'vitest';
import { app } from '../../src/app.js';

export const api = request(app);

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
