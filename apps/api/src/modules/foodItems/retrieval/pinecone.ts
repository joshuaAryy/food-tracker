import { Pinecone } from '@pinecone-database/pinecone';

export const SEMANTIC_INDEX_VERSION = 'food-search-v1';
export const SEMANTIC_MODEL_VERSION = 'multilingual-e5-large';

export interface SemanticSearchMatch {
  foodItemId: string;
  score: number;
  metadata: Record<string, string | number | boolean | null>;
}

export interface SemanticSearchClient {
  search(query: string, timeoutMs: number): Promise<SemanticSearchMatch[]>;
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
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Pinecone search timeout')),
          timeoutMs,
        ),
      );
      const response = await Promise.race([
        index.searchRecords({
          query: { inputs: { text: `query: ${query}` }, topK: input.topK },
        }),
        timeout,
      ]);
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
                .map(([key, value]) => [
                  key,
                  value as string | number | boolean,
                ]),
            ),
          },
        ];
      });
    },
  };
}
