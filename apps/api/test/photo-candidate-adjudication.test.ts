import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  photoCandidateAdjudicationProvider,
  type PhotoAdjudicationConfig,
  type PhotoAdjudicationRequest,
} from '../src/modules/ai/photo-candidate-adjudication.js';

const request: PhotoAdjudicationRequest = {
  rows: [
    {
      recognitionRef: 'photo-item-1',
      recognizedName: 'pasta',
      preparationForm: 'cooked',
      quantity: {
        state: 'estimated',
        amount: 1.5,
        unit: 'cup',
        countLabel: null,
        rawText: 'approximately 1.5 cups',
        confidence: 'medium',
      },
      representationKind: 'component',
      coverage: ['pasta'],
      visiblePortionDescription: null,
      candidates: [
        {
          candidateRef: 'candidate-1-1',
          displayName: 'Pasta, cooked',
          brandName: null,
          preparationForm: 'cooked',
          foodType: 'generic',
          source: 'usda_fdc',
          servingLabels: ['1 cup'],
        },
        {
          candidateRef: 'candidate-1-2',
          displayName: 'Pasta, dry',
          brandName: null,
          preparationForm: 'dry',
          foodType: 'generic',
          source: 'usda_fdc',
          servingLabels: ['1 cup'],
        },
      ],
    },
  ],
};

const config: PhotoAdjudicationConfig = {
  provider: 'gemini',
  geminiApiKey: 'test-key',
  geminiModel: 'gemini-2.5-flash',
  timeoutMs: 5_000,
  maxCandidates: 3,
  maxRows: 8,
  maxOutputTokens: 1_024,
  mockDecision: 'no_decision',
};

describe('photo candidate adjudication provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends one bounded text-only request with opaque candidate references', async () => {
    let body: Record<string, unknown> | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        decisions: [
                          {
                            recognitionRef: 'photo-item-1',
                            decision: 'select_candidate',
                            candidateRef: 'candidate-1-1',
                            confidence: 'high',
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const result = await photoCandidateAdjudicationProvider(config).adjudicate({
      request,
      signal: new AbortController().signal,
    });

    expect(result).toMatchObject({
      status: 'completed',
      decisions: [
        {
          recognitionRef: 'photo-item-1',
          decision: 'select_candidate',
          candidateRef: 'candidate-1-1',
          confidence: 'high',
        },
      ],
    });
    expect(body?.contents).toEqual([
      { parts: [{ text: expect.stringContaining('candidate-1-1') }] },
    ]);
    expect(JSON.stringify(body)).not.toContain('test-key');
    expect(JSON.stringify(body)).not.toContain('image');
    expect(JSON.stringify(body)).not.toContain('calories');
    expect(
      (body?.generationConfig as Record<string, unknown>).candidateCount,
    ).toBe(1);
    expect(
      (body?.generationConfig as Record<string, unknown>).thinkingConfig,
    ).toEqual({ thinkingBudget: 0 });
  });

  it('keeps signed final text while excluding explicit thought parts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      { text: 'internal reasoning', thought: true },
                      {
                        text: JSON.stringify({
                          decisions: [
                            {
                              recognitionRef: 'photo-item-1',
                              decision: 'select_candidate',
                              candidateRef: 'candidate-1-1',
                              confidence: 'high',
                            },
                          ],
                        }),
                        thoughtSignature: 'provider-signature',
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const result = await photoCandidateAdjudicationProvider(config).adjudicate({
      request,
      signal: new AbortController().signal,
    });

    expect(result).toMatchObject({
      status: 'completed',
      decisions: [
        {
          recognitionRef: 'photo-item-1',
          decision: 'select_candidate',
          candidateRef: 'candidate-1-1',
          confidence: 'high',
        },
      ],
    });
  });

  it('preserves a bounded reject-all and no-decision contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          decisions: [
                            {
                              recognitionRef: 'photo-item-1',
                              decision: 'reject_all',
                              confidence: 'high',
                            },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const result = await photoCandidateAdjudicationProvider(config).adjudicate({
      request,
      signal: new AbortController().signal,
    });

    expect(result.decisions[0]).toEqual({
      recognitionRef: 'photo-item-1',
      decision: 'reject_all',
      confidence: 'high',
    });
  });

  it.each([
    {
      name: 'unknown recognition reference',
      decision: {
        recognitionRef: 'unknown',
        decision: 'select_candidate',
        candidateRef: 'candidate-1-1',
        confidence: 'high',
      },
    },
    {
      name: 'candidate from another row',
      decision: {
        recognitionRef: 'photo-item-1',
        decision: 'select_candidate',
        candidateRef: 'candidate-9-9',
        confidence: 'high',
      },
    },
    {
      name: 'duplicate decision',
      decision: {
        recognitionRef: 'photo-item-1',
        decision: 'no_decision',
      },
    },
  ])('returns invalid_response for $name', async ({ decision }) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          decisions:
                            decision.recognitionRef === 'photo-item-1'
                              ? [decision, decision]
                              : [decision],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const result = await photoCandidateAdjudicationProvider(config).adjudicate({
      request,
      signal: new AbortController().signal,
    });

    expect(result.status).toBe('invalid_response');
    expect(result.decisions).toEqual([]);
  });

  it('returns unavailable without throwing on an upstream failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 429 })),
    );

    const result = await photoCandidateAdjudicationProvider(config).adjudicate({
      request,
      signal: new AbortController().signal,
    });

    expect(result).toEqual({ status: 'unavailable', decisions: [] });
  });

  it('rejects nutrition-bearing and non-STOP adjudication output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          decisions: [
                            {
                              recognitionRef: 'photo-item-1',
                              decision: 'no_decision',
                              calories: 400,
                            },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const invalid = await photoCandidateAdjudicationProvider(config).adjudicate(
      { request, signal: new AbortController().signal },
    );
    expect(invalid.status).toBe('invalid_response');

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'MAX_TOKENS',
                  content: { parts: [{ text: '{"decisions":[]}' }] },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );
    const truncated = await photoCandidateAdjudicationProvider(
      config,
    ).adjudicate({ request, signal: new AbortController().signal });
    expect(truncated.status).toBe('unavailable');
  });
});
