import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { retrieveParsedFoodItems } from '../src/modules/ai/retrieval.js';
import {
  semanticSearchTimeoutMs,
  type SemanticSearchClient,
} from '../src/modules/foodItems/retrieval/pinecone.js';
import { FOOD_RETRIEVAL_CORPUS } from '../src/benchmarks/food-retrieval/corpus.js';
import { retrieveLiveBenchmarkObservation } from '../src/benchmarks/food-retrieval/live.js';

const originalTimeout = process.env.PINECONE_SEARCH_TIMEOUT_MS;

afterEach(() => {
  if (originalTimeout === undefined) {
    delete process.env.PINECONE_SEARCH_TIMEOUT_MS;
  } else {
    process.env.PINECONE_SEARCH_TIMEOUT_MS = originalTimeout;
  }
  delete process.env.PINECONE_API_KEY;
  delete process.env.PINECONE_INDEX_HOST;
});

describe('semantic search timeout policy', () => {
  it('defaults invalid, blank, and unset values to 500 milliseconds', () => {
    for (const value of [undefined, '', '  ', 'invalid', '0', '-1', '1.5']) {
      if (value === undefined) delete process.env.PINECONE_SEARCH_TIMEOUT_MS;
      else process.env.PINECONE_SEARCH_TIMEOUT_MS = value;
      expect(semanticSearchTimeoutMs()).toBe(500);
    }
  });

  it('honors a positive finite integer override', () => {
    process.env.PINECONE_SEARCH_TIMEOUT_MS = '750';
    expect(semanticSearchTimeoutMs()).toBe(750);
  });
});

describe('semantic timeout fallback behavior', () => {
  it('keeps AI retrieval usable after one semantic timeout', async () => {
    let calls = 0;
    let observedTimeout = 0;
    const semanticClient: SemanticSearchClient = {
      search: async (_query, timeoutMs) => {
        calls += 1;
        observedTimeout = timeoutMs;
        throw new Error('Pinecone search timeout');
      },
    };

    const [result] = await retrieveParsedFoodItems({
      userId: '00000000-0000-4000-8000-000000000001',
      rateLimitKey: 'timeout-test',
      parsedItems: [
        { name: 'timeout-only-query', quantityText: null, servingText: null },
      ],
      semanticClient,
    });

    expect(result).toBeDefined();
    expect(calls).toBe(1);
    expect(observedTimeout).toBe(500);
  });

  it('keeps semantic and full-hybrid benchmark observations after timeout', async () => {
    const query = FOOD_RETRIEVAL_CORPUS[0];
    if (query === undefined) throw new Error('benchmark corpus is empty');
    let calls = 0;
    const observedTimeouts: number[] = [];
    const semanticClient: SemanticSearchClient = {
      search: async (_query, timeoutMs) => {
        calls += 1;
        observedTimeouts.push(timeoutMs);
        throw new Error('Pinecone search timeout');
      },
    };

    const semantic = await retrieveLiveBenchmarkObservation({
      prisma,
      query,
      mode: 'semantic',
      semanticClient,
    });
    const hybrid = await retrieveLiveBenchmarkObservation({
      prisma,
      query,
      mode: 'full_hybrid',
      semanticClient,
    });

    expect(semantic.pineconeCallCount).toBe(1);
    expect(semantic.externalCallCount).toBe(1);
    expect(
      semantic.candidates.every(
        (candidate) => candidate.evidence !== 'semantic',
      ),
    ).toBe(true);
    expect(hybrid.pineconeCallCount).toBe(1);
    expect(hybrid.externalCallCount).toBe(1);
    expect(
      hybrid.candidates.every((candidate) => candidate.evidence !== 'semantic'),
    ).toBe(true);
    expect(calls).toBe(2);
    expect(observedTimeouts).toEqual([500, 500]);
  });

  it('keeps successful semantic accounting and candidates unchanged', async () => {
    const query = FOOD_RETRIEVAL_CORPUS[0];
    if (query === undefined) throw new Error('benchmark corpus is empty');
    const semanticClient: SemanticSearchClient = {
      search: async () => [],
    };
    const observation = await retrieveLiveBenchmarkObservation({
      prisma,
      query,
      mode: 'semantic',
      semanticClient,
    });

    expect(observation.pineconeCallCount).toBe(1);
    expect(observation.externalCallCount).toBe(1);
    expect(
      observation.candidates.every(
        (candidate) => candidate.evidence !== 'semantic',
      ),
    ).toBe(true);
  });
});
