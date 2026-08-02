import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requestContext } from '../src/middleware/request-context.js';

describe('request context', () => {
  it('creates an opaque correlation id without exposing request details', async () => {
    const app = express();
    app.use(
      requestContext({
        createRequestId: () => 'req_opaque_test',
        now: () => 1234,
      }),
    );
    app.get('/context', (_request, response) => {
      response.json({
        requestId: response.locals.requestId,
        startedAt: response.locals.requestStartedAt,
      });
    });

    const response = await request(app).get(
      '/context?email=service-account@example.com',
    );

    expect(response.body).toEqual({
      requestId: 'req_opaque_test',
      startedAt: 1234,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /service-account|context\?|email|localhost|api\/v1/,
    );
  });
});
