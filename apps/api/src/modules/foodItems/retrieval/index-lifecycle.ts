import { Pinecone } from '@pinecone-database/pinecone';
import type { PrismaClient } from '@prisma/client';
import { semanticIndexVersionName, semanticModelVersion } from './pinecone.js';

/** Pinecone list pagination rejects limits of 100 or greater. */
export const PINECONE_LIST_PAGE_SIZE = 99;
export const PINECONE_UPSERT_BATCH_SIZE = 96;
export const PINECONE_UPSERT_MAX_ATTEMPTS = 3;
/** Integrated inference TPM quotas recover on a minute boundary. */
export const PINECONE_UPSERT_RETRY_DELAY_MS = 65_000;

interface PineconeListPage {
  vectors?: readonly { id?: string | null }[];
  pagination?: { next?: string | null };
}

interface PineconeListIndex {
  listPaginated(options: {
    limit: number;
    paginationToken?: string;
  }): Promise<PineconeListPage>;
}

export interface FoodSearchDocument {
  id: string;
  text: string;
  sourceProvider: string | null;
  sourceRegion: string | null;
  sourceType: 'app_owned';
  rankingClass: 'app_curated' | 'reference';
  datasetRelease: string | null;
  hasBarcode: boolean;
}

export interface IndexLifecycleConfig {
  apiKey: string;
  indexHost: string;
  activeNamespace: string;
  candidateNamespace: string;
  timeoutMs: number;
}

export interface IndexVersionRecord {
  indexVersion: string;
  namespace: string;
  embeddingModel: string;
  documentFormat: string;
  status: 'building' | 'ready' | 'active' | 'retired' | 'failed';
  documentCount: number;
}

export interface SearchDocumentUpsertProgress {
  indexed: number;
  total: number;
  retryAfterMs?: number;
}

type SearchDocumentUpsertProgressReporter = (
  progress: SearchDocumentUpsertProgress,
) => void;

function retryInteger(value: number | undefined, fallback: number): number {
  return value !== undefined &&
    Number.isFinite(value) &&
    Number.isInteger(value)
    ? value
    : fallback;
}

function isPineconeRateLimitError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const record = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
    cause?: { message?: unknown };
    response?: { status?: unknown };
  };
  const status = record.status ?? record.statusCode ?? record.response?.status;
  const statusCode = typeof status === 'number' ? status : Number(status);
  const code = typeof record.code === 'string' ? record.code : '';
  const message = [record.message, record.cause?.message]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  return (
    statusCode === 429 ||
    code.toUpperCase() === 'RESOURCE_EXHAUSTED' ||
    message.includes('resource_exhausted') ||
    /\b429\b/.test(message)
  );
}

export async function resolveActiveSemanticNamespace(input: {
  prisma: Pick<PrismaClient, 'foodSearchIndexVersion'>;
  fallback: string;
}): Promise<string> {
  try {
    const active = await input.prisma.foodSearchIndexVersion.findFirst({
      where: { status: 'active' },
      orderBy: [{ activatedAt: 'desc' }],
      select: { namespace: true },
    });
    return active?.namespace ?? input.fallback;
  } catch {
    return input.fallback;
  }
}

export function searchDocumentForFood(input: {
  id: string;
  name: string;
  aliases: readonly string[];
  searchText?: string | null;
  brandName: string | null;
  category: string | null;
  preparation: string | null;
  sourceProvider: string | null;
  sourceRegion: string | null;
  sourceType: 'app_owned';
  rankingClass: 'app_curated' | 'reference';
  datasetRelease: string | null;
  hasBarcode: boolean;
}): FoodSearchDocument {
  return {
    id: input.id,
    text: [
      input.name,
      ...input.aliases,
      input.searchText,
      input.brandName,
      input.category,
      input.preparation,
    ]
      .filter(Boolean)
      .join(' '),
    sourceProvider: input.sourceProvider,
    sourceRegion: input.sourceRegion,
    sourceType: input.sourceType,
    rankingClass: input.rankingClass,
    datasetRelease: input.datasetRelease,
    hasBarcode: input.hasBarcode,
  };
}

export function semanticIndexVersion(): string {
  return `${semanticIndexVersionName()}:${semanticModelVersion()}`;
}

export function versionedNamespace(
  baseNamespace: string,
  version = semanticIndexVersion(),
): string {
  return `${baseNamespace}-${version.replace(/[^a-zA-Z0-9-]/g, '-')}`.slice(
    0,
    63,
  );
}

export function buildIndexVersionRecord(input: {
  namespace: string;
  documentCount: number;
  status?: IndexVersionRecord['status'];
}): IndexVersionRecord {
  return {
    indexVersion: semanticIndexVersion(),
    namespace: input.namespace,
    embeddingModel: semanticModelVersion(),
    documentFormat: 'food-search-document-v1',
    status: input.status ?? 'building',
    documentCount: input.documentCount,
  };
}

export function staleSearchDocumentIds(
  indexedIds: readonly string[],
  authoritativeIds: readonly string[],
): string[] {
  const current = new Set(authoritativeIds);
  return [...new Set(indexedIds)].filter((id) => !current.has(id));
}

export async function upsertSearchDocuments(input: {
  config: IndexLifecycleConfig;
  documents: readonly FoodSearchDocument[];
  maxAttempts?: number;
  retryDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
  onProgress?: SearchDocumentUpsertProgressReporter;
}): Promise<void> {
  const client = new Pinecone({ apiKey: input.config.apiKey });
  const index = client.index({
    host: input.config.indexHost,
    namespace: input.config.candidateNamespace,
  });
  const maxAttempts = Math.max(
    1,
    retryInteger(input.maxAttempts, PINECONE_UPSERT_MAX_ATTEMPTS),
  );
  const retryDelayMs = Math.max(
    0,
    retryInteger(input.retryDelayMs, PINECONE_UPSERT_RETRY_DELAY_MS),
  );
  const sleep =
    input.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  let indexed = 0;
  for (
    let offset = 0;
    offset < input.documents.length;
    offset += PINECONE_UPSERT_BATCH_SIZE
  ) {
    const batch = input.documents.slice(
      offset,
      offset + PINECONE_UPSERT_BATCH_SIZE,
    );
    const records = batch.map((document) => ({
      id: document.id,
      text: document.text,
      sourceProvider: document.sourceProvider ?? '',
      sourceRegion: document.sourceRegion ?? '',
      sourceType: document.sourceType,
      rankingClass: document.rankingClass,
      datasetRelease: document.datasetRelease ?? '',
      hasBarcode: document.hasBarcode,
      indexVersion: semanticIndexVersion(),
    }));
    for (let attempt = 1; ; attempt += 1) {
      try {
        await index.upsertRecords({ records });
        indexed += batch.length;
        input.onProgress?.({ indexed, total: input.documents.length });
        break;
      } catch (error) {
        if (!isPineconeRateLimitError(error) || attempt >= maxAttempts)
          throw error;
        input.onProgress?.({
          indexed,
          total: input.documents.length,
          retryAfterMs: retryDelayMs,
        });
        await sleep(retryDelayMs);
      }
    }
  }
}

export async function deleteStaleSearchDocuments(input: {
  config: IndexLifecycleConfig;
  staleIds: readonly string[];
  maxAttempts?: number;
}): Promise<number> {
  if (input.staleIds.length === 0) return 0;
  const client = new Pinecone({ apiKey: input.config.apiKey });
  const index = client.index({
    host: input.config.indexHost,
    namespace: input.config.candidateNamespace,
  });
  const maxAttempts = Math.max(1, input.maxAttempts ?? 3);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      for (let offset = 0; offset < input.staleIds.length; offset += 1000) {
        await index.deleteMany({
          ids: input.staleIds.slice(offset, offset + 1000),
        });
      }
      return input.staleIds.length;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, 100 * 2 ** (attempt - 1)),
      );
    }
  }
  return 0;
}

export async function listIndexedSearchDocumentIds(
  index: PineconeListIndex,
): Promise<string[]> {
  const indexedIds: string[] = [];
  let paginationToken: string | undefined;
  do {
    const page = await index.listPaginated({
      limit: PINECONE_LIST_PAGE_SIZE,
      ...(paginationToken === undefined ? {} : { paginationToken }),
    });
    for (const item of page.vectors ?? []) {
      if (typeof item.id === 'string') indexedIds.push(item.id);
    }
    paginationToken = page.pagination?.next ?? undefined;
  } while (paginationToken !== undefined);
  return indexedIds;
}

export async function reconcileSearchDocuments(input: {
  config: IndexLifecycleConfig;
  documents: readonly FoodSearchDocument[];
  maxAttempts?: number;
  retryDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
  onProgress?: SearchDocumentUpsertProgressReporter;
}): Promise<{ indexed: number; staleDeleted: number }> {
  const client = new Pinecone({ apiKey: input.config.apiKey });
  const index = client.index({
    host: input.config.indexHost,
    namespace: input.config.candidateNamespace,
  });
  const indexedIds = await listIndexedSearchDocumentIds(index);
  const staleIds = staleSearchDocumentIds(
    indexedIds,
    input.documents.map((document) => document.id),
  );
  const staleDeleted = await deleteStaleSearchDocuments({
    config: input.config,
    staleIds,
  });
  await upsertSearchDocuments(input);
  return { indexed: input.documents.length, staleDeleted };
}
