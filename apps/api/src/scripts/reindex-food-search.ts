import { readFile } from 'node:fs/promises';
import {
  upsertSearchDocuments,
  type FoodSearchDocument,
  type IndexLifecycleConfig,
} from '../modules/foodItems/retrieval/index-lifecycle.js';

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (inputPath === undefined)
    throw new Error('Usage: reindex-food-search <documents.json>');
  const documents = JSON.parse(
    await readFile(inputPath, 'utf8'),
  ) as FoodSearchDocument[];
  const required = ['PINECONE_API_KEY', 'PINECONE_INDEX_HOST'];
  for (const key of required)
    if (!process.env[key]) throw new Error(`${key} is required`);
  const config: IndexLifecycleConfig = {
    apiKey: process.env.PINECONE_API_KEY ?? '',
    indexHost: process.env.PINECONE_INDEX_HOST ?? '',
    activeNamespace: process.env.PINECONE_ACTIVE_NAMESPACE ?? 'food-search-v1',
    candidateNamespace:
      process.env.PINECONE_CANDIDATE_NAMESPACE ?? 'food-search-next',
    timeoutMs: 5000,
  };
  await upsertSearchDocuments({
    config,
    documents: documents.filter(
      (document) =>
        document.rankingClass === 'reference' ||
        document.rankingClass === 'app_curated',
    ),
  });
  console.log(
    JSON.stringify({
      indexed: documents.length,
      namespace: config.candidateNamespace,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
