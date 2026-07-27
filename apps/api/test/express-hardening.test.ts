import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { errorHandler } from '../src/middleware/error-handler.js';

describe('Express hardening', () => {
  it('removes framework disclosure, adds security headers, and disables caching', async () => {
    const response = await request(app)
      .get('/missing-route')
      .set('Origin', 'https://unknown.example');

    expect(response.status).toBe(404);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects oversized JSON before a protected route executes', async () => {
    const isolated = express();
    isolated.use(express.json({ limit: '1kb', strict: true }));
    isolated.post('/oversized', (_request, response) =>
      response.json({ ok: true }),
    );
    isolated.use(errorHandler);

    const response = await request(isolated)
      .post('/oversized')
      .send({ payload: 'x'.repeat(2_000) })
      .type('json');

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'IMAGE_TOO_LARGE',
        message: 'The uploaded image is larger than 5 MiB.',
        details: {},
      },
    });
  });

  it('keeps JSON parsing strict for an unrelated app instance', async () => {
    const isolated = express();
    isolated.use(express.json({ limit: '1kb', strict: true }));
    isolated.post('/json', (_request, response) => response.json({ ok: true }));

    const response = await request(isolated)
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('1');

    expect(response.status).toBe(400);
  });
});
