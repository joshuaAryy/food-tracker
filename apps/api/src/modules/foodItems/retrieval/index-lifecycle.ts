import { Pinecone } from '@pinecone-database/pinecone';
import { SEMANTIC_INDEX_VERSION, SEMANTIC_MODEL_VERSION } from './pinecone.js';

export interface FoodSearchDocument {
  id: string;
  text: string;
  sourceProvider: string | null;
  sourceRegion: string | null;
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

export function searchDocumentForFood(input: {
  id: string;
  name: string;
  aliases: readonly string[];
  brandName: string | null;
  category: string | null;
  preparation: string | null;
  sourceProvider: string | null;
  sourceRegion: string | null;
  rankingClass: 'app_curated' | 'reference';
  datasetRelease: string | null;
  hasBarcode: boolean;
}): FoodSearchDocument {
  return {
    id: input.id,
    text: [
      input.name,
      ...input.aliases,
      input.brandName,
      input.category,
      input.preparation,
    ]
      .filter(Boolean)
      .join(' '),
    sourceProvider: input.sourceProvider,
    sourceRegion: input.sourceRegion,
    rankingClass: input.rankingClass,
    datasetRelease: input.datasetRelease,
    hasBarcode: input.hasBarcode,
  };
}

export function semanticIndexVersion(): string {
  return `${SEMANTIC_INDEX_VERSION}:${SEMANTIC_MODEL_VERSION}`;
}

export async function upsertSearchDocuments(input: {
  config: IndexLifecycleConfig;
  documents: readonly FoodSearchDocument[];
}): Promise<void> {
  const client = new Pinecone({ apiKey: input.config.apiKey });
  const index = client.index({
    host: input.config.indexHost,
    namespace: input.config.candidateNamespace,
  });
  for (let offset = 0; offset < input.documents.length; offset += 96) {
    const batch = input.documents.slice(offset, offset + 96);
    await index.upsertRecords({
      records: batch.map((document) => ({
        _id: document.id,
        text: document.text,
        sourceProvider: document.sourceProvider ?? '',
        sourceRegion: document.sourceRegion ?? '',
        rankingClass: document.rankingClass,
        datasetRelease: document.datasetRelease ?? '',
        hasBarcode: document.hasBarcode,
        indexVersion: semanticIndexVersion(),
      })),
    });
  }
}
