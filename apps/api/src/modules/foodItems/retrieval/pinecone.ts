import { Pinecone } from '@pinecone-database/pinecone';

export const SEMANTIC_INDEX_VERSION = 'food-search-v1';
export const SEMANTIC_MODEL_VERSION = 'multilingual-e5-large';

export function semanticModelVersion(
  configured = process.env.PINECONE_EMBEDDING_MODEL,
): string {
  const value = configured?.trim();
  return value === undefined || value.length === 0
    ? SEMANTIC_MODEL_VERSION
    : value;
}

export function semanticIndexVersionName(
  configured = process.env.PINECONE_SEMANTIC_INDEX_VERSION,
): string {
  const value = configured?.trim();
  return value === undefined || value.length === 0
    ? SEMANTIC_INDEX_VERSION
    : value;
}

export interface SemanticSearchMatch {
  foodItemId: string;
  score: number;
  metadata: Record<string, string | number | boolean | null>;
}

export interface SemanticSearchClient {
  search(query: string, timeoutMs: number): Promise<SemanticSearchMatch[]>;
}

export async function boundedSemanticSearch<T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Pinecone search timeout')),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function parseSemanticSearchResponse(
  response: unknown,
): SemanticSearchMatch[] {
  const hits =
    (
      response as {
        result?: {
          hits?: Array<{
            _id?: string;
            _score?: number;
            fields?: Record<string, unknown>;
          }>;
        };
      }
    ).result?.hits ?? [];
  return hits.flatMap((hit) => {
    if (typeof hit._id !== 'string') return [];
    return [
      {
        foodItemId: hit._id,
        score: typeof hit._score === 'number' ? hit._score : 0,
        metadata: Object.fromEntries(
          Object.entries(hit.fields ?? {})
            .filter(([, value]) =>
              ['string', 'number', 'boolean'].includes(typeof value),
            )
            .map(([key, value]) => [key, value as string | number | boolean]),
        ),
      },
    ];
  });
}

export async function createSemanticIndex(input: {
  apiKey: string;
  name: string;
  cloud: string;
  region: string;
}): Promise<{ host: string; name: string }> {
  const client = new Pinecone({ apiKey: input.apiKey });
  const created = await client.createIndexForModel({
    name: input.name,
    cloud: input.cloud,
    region: input.region,
    embed: {
      model: semanticModelVersion(),
      fieldMap: { text: 'text' },
    },
    waitUntilReady: true,
  });
  if (
    created === undefined ||
    typeof created !== 'object' ||
    created.host === undefined
  ) {
    throw new Error('Pinecone did not return an index host');
  }
  return { host: created.host, name: input.name };
}

export function createPineconeSemanticClient(input: {
  apiKey: string;
  indexHost: string;
  namespace: string;
  topK: number;
}): SemanticSearchClient {
  const client = new Pinecone({ apiKey: input.apiKey });
  const index = client.index({
    host: input.indexHost,
    namespace: input.namespace,
  });
  return {
    async search(query, timeoutMs) {
      const response = await boundedSemanticSearch(
        index.searchRecords({
          query: { inputs: { text: query }, topK: input.topK },
        }),
        timeoutMs,
      );
      return parseSemanticSearchResponse(response);
    },
  };
}
