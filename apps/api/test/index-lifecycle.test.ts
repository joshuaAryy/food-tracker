import { beforeEach, describe, expect, it, vi } from 'vitest';

const pinecone = vi.hoisted(() => {
  const index = {
    listPaginated: vi.fn(),
    deleteMany: vi.fn(),
    upsertRecords: vi.fn(),
  };
  const client = {
    index: vi.fn(() => index),
  };
  class MockPinecone {
    index() {
      return client.index();
    }
  }
  return {
    index,
    Pinecone: MockPinecone,
  };
});

vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: pinecone.Pinecone,
}));

import {
  PINECONE_LIST_PAGE_SIZE,
  reconcileSearchDocuments,
  PINECONE_UPSERT_BATCH_SIZE,
  PINECONE_UPSERT_MAX_ATTEMPTS,
  PINECONE_UPSERT_RETRY_DELAY_MS,
} from '../src/modules/foodItems/retrieval/index-lifecycle.js';

function document(id: string) {
  return {
    id,
    text: `food ${id}`,
    sourceProvider: 'cnf',
    sourceRegion: 'CA',
    sourceType: 'app_owned' as const,
    rankingClass: 'reference' as const,
    datasetRelease: '2026',
    hasBarcode: false,
  };
}

const config = {
  apiKey: 'test-key',
  indexHost: 'https://example.test',
  activeNamespace: 'active',
  candidateNamespace: 'candidate',
  timeoutMs: 5000,
};

describe('Pinecone search-document reconciliation', () => {
  beforeEach(() => {
    pinecone.index.listPaginated.mockReset();
    pinecone.index.deleteMany.mockReset();
    pinecone.index.upsertRecords.mockReset();
    pinecone.index.deleteMany.mockResolvedValue(undefined);
    pinecone.index.upsertRecords.mockResolvedValue(undefined);
  });

  it('uses a supported page size and reconciles a single page', async () => {
    pinecone.index.listPaginated.mockResolvedValueOnce({
      vectors: [{ id: 'stale-1' }, { id: 'current-1' }],
    });

    await expect(
      reconcileSearchDocuments({
        config,
        documents: [document('current-1')],
      }),
    ).resolves.toEqual({ indexed: 1, staleDeleted: 1 });

    expect(PINECONE_LIST_PAGE_SIZE).toBe(99);
    expect(pinecone.index.listPaginated).toHaveBeenCalledWith({ limit: 99 });
    expect(pinecone.index.deleteMany).toHaveBeenCalledWith({
      ids: ['stale-1'],
    });
    expect(pinecone.index.upsertRecords).toHaveBeenCalledTimes(1);
  });

  it('follows every page, including later stale IDs, and deduplicates listed IDs', async () => {
    const firstPageIds = Array.from(
      { length: 99 },
      (_, index) => `id-${index}`,
    );
    pinecone.index.listPaginated
      .mockResolvedValueOnce({
        vectors: firstPageIds.map((id) => ({ id })),
        pagination: { next: 'page-2' },
      })
      .mockResolvedValueOnce({
        vectors: [
          { id: 'id-98' },
          { id: 'stale-late-1' },
          { id: 'stale-late-2' },
          { id: 'stale-late-2' },
        ],
      });

    const documents = [
      ...firstPageIds.slice(0, 98).map(document),
      document('id-100'),
    ];
    await expect(
      reconcileSearchDocuments({ config, documents }),
    ).resolves.toEqual({ indexed: 99, staleDeleted: 3 });

    expect(pinecone.index.listPaginated).toHaveBeenNthCalledWith(1, {
      limit: 99,
    });
    expect(pinecone.index.listPaginated).toHaveBeenNthCalledWith(2, {
      limit: 99,
      paginationToken: 'page-2',
    });
    expect(pinecone.index.deleteMany).toHaveBeenCalledWith({
      ids: ['id-98', 'stale-late-1', 'stale-late-2'],
    });
    expect(pinecone.index.upsertRecords).toHaveBeenCalledTimes(2);
  });

  it('retries a rate-limited batch without advancing progress or changing its records', async () => {
    pinecone.index.listPaginated.mockResolvedValueOnce({ vectors: [] });
    const rateLimited = Object.assign(
      new Error('RESOURCE_EXHAUSTED: max tokens per minute'),
      { status: 429, code: 'RESOURCE_EXHAUSTED' },
    );
    pinecone.index.upsertRecords
      .mockRejectedValueOnce(rateLimited)
      .mockResolvedValueOnce(undefined);
    const sleep = vi.fn(async () => undefined);
    const progress: { indexed: number; retryAfterMs?: number }[] = [];

    await reconcileSearchDocuments({
      config,
      documents: [document('retry-1')],
      retryDelayMs: 0,
      sleep,
      onProgress: ({ indexed, retryAfterMs }) =>
        progress.push({
          indexed,
          ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
        }),
    });

    expect(pinecone.index.upsertRecords).toHaveBeenCalledTimes(2);
    expect(pinecone.index.upsertRecords.mock.calls[0]?.[0]).toEqual(
      pinecone.index.upsertRecords.mock.calls[1]?.[0],
    );
    expect(progress).toEqual([{ indexed: 0, retryAfterMs: 0 }, { indexed: 1 }]);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('bounds repeated rate-limit retries and preserves the failed batch progress', async () => {
    pinecone.index.listPaginated.mockResolvedValueOnce({ vectors: [] });
    pinecone.index.upsertRecords.mockRejectedValue({
      status: 429,
      code: 'RESOURCE_EXHAUSTED',
      message: 'quota exhausted',
    });
    const sleep = vi.fn(async () => undefined);
    const progress: number[] = [];

    await expect(
      reconcileSearchDocuments({
        config,
        documents: [document('bounded-retry')],
        maxAttempts: 3,
        retryDelayMs: 0,
        sleep,
        onProgress: ({ indexed }) => progress.push(indexed),
      }),
    ).rejects.toThrow('quota exhausted');
    expect(pinecone.index.upsertRecords).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(progress).toEqual([0, 0]);
  });

  it('fails immediately for non-rate-limit upsert errors', async () => {
    pinecone.index.listPaginated.mockResolvedValueOnce({ vectors: [] });
    pinecone.index.upsertRecords.mockRejectedValue(
      new Error('invalid record payload'),
    );
    const sleep = vi.fn(async () => undefined);

    await expect(
      reconcileSearchDocuments({
        config,
        documents: [document('non-rate-limit')],
        retryDelayMs: 0,
        sleep,
      }),
    ).rejects.toThrow('invalid record payload');
    expect(pinecone.index.upsertRecords).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('uploads every document batch exactly once after a successful retry', async () => {
    pinecone.index.listPaginated.mockResolvedValueOnce({ vectors: [] });
    const documents = Array.from(
      { length: PINECONE_UPSERT_BATCH_SIZE + 4 },
      (_, index) => document(`batch-${index}`),
    );
    const rateLimited = Object.assign(new Error('RESOURCE_EXHAUSTED'), {
      status: 429,
    });
    pinecone.index.upsertRecords
      .mockRejectedValueOnce(rateLimited)
      .mockResolvedValue(undefined);
    const progress: number[] = [];

    await reconcileSearchDocuments({
      config,
      documents,
      retryDelayMs: 0,
      sleep: async () => undefined,
      onProgress: ({ indexed }) => progress.push(indexed),
    });

    expect(pinecone.index.upsertRecords).toHaveBeenCalledTimes(3);
    const uploadedIds = pinecone.index.upsertRecords.mock.calls.flatMap(
      ([request]) =>
        (request as { records: { id: string }[] }).records.map(
          (record) => record.id,
        ),
    );
    expect(uploadedIds).toEqual([
      ...documents.slice(0, PINECONE_UPSERT_BATCH_SIZE).map(({ id }) => id),
      ...documents.slice(0, PINECONE_UPSERT_BATCH_SIZE).map(({ id }) => id),
      ...documents.slice(PINECONE_UPSERT_BATCH_SIZE).map(({ id }) => id),
    ]);
    expect(progress).toEqual([0, PINECONE_UPSERT_BATCH_SIZE, documents.length]);
  });

  it('keeps the documented bounded retry defaults', () => {
    expect(PINECONE_UPSERT_MAX_ATTEMPTS).toBe(3);
    expect(PINECONE_UPSERT_RETRY_DELAY_MS).toBe(65_000);
  });

  it('propagates a failed reconciliation and allows a subsequent retry to succeed', async () => {
    pinecone.index.listPaginated
      .mockRejectedValueOnce(new Error('temporary Pinecone failure'))
      .mockResolvedValueOnce({ vectors: [] });

    await expect(
      reconcileSearchDocuments({ config, documents: [document('current-1')] }),
    ).rejects.toThrow('temporary Pinecone failure');
    expect(pinecone.index.upsertRecords).not.toHaveBeenCalled();

    await expect(
      reconcileSearchDocuments({ config, documents: [document('current-1')] }),
    ).resolves.toEqual({ indexed: 1, staleDeleted: 0 });
    expect(pinecone.index.upsertRecords).toHaveBeenCalledTimes(1);
  });
});
