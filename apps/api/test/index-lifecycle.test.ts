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
