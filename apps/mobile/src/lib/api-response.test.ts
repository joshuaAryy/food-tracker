import { describe, expect, it } from 'vitest';
import { parseApiResponse } from './api-response';

describe('canonical response parser diagnostics', () => {
  it('reports the response boundary stages in order without exposing the payload', async () => {
    const stages: string[] = [];
    const response = new Response(
      JSON.stringify({ success: true, data: { value: 42 } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );

    await expect(
      parseApiResponse(
        response,
        {
          safeParse: (value) =>
            value !== null &&
            typeof value === 'object' &&
            (value as { value?: unknown }).value === 42
              ? { success: true, data: { value: 42 } }
              : { success: false },
        },
        undefined,
        undefined,
        (stage, status) => stages.push(`${stage}:${status}`),
      ),
    ).resolves.toEqual({ value: 42 });

    expect(stages).toEqual([
      'response_text_read:200',
      'json_parse_succeeded:200',
      'envelope_parse_succeeded:200',
      'canonical_schema_parse_succeeded:200',
    ]);
  });

  it('reports a JSON parse failure without including response text', async () => {
    const stages: string[] = [];

    await expect(
      parseApiResponse(
        new Response('private response body', { status: 502 }),
        undefined,
        undefined,
        undefined,
        (stage, status) => stages.push(`${stage}:${status}`),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });

    expect(stages).toEqual(['response_text_read:502', 'json_parse_failed:502']);
  });

  it('reports malformed error envelopes as an envelope parse failure', async () => {
    const stages: string[] = [];

    await expect(
      parseApiResponse(
        new Response(JSON.stringify({ success: false, error: {} }), {
          status: 400,
        }),
        undefined,
        undefined,
        undefined,
        (stage, status) => stages.push(`${stage}:${status}`),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 400 });

    expect(stages).toEqual([
      'response_text_read:400',
      'json_parse_succeeded:400',
      'envelope_parse_succeeded:400',
      'envelope_parse_failed:400',
    ]);
  });
});
