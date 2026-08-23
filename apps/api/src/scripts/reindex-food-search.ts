import { readFile } from 'node:fs/promises';
import { prisma } from '../lib/prisma.js';
import {
  buildIndexVersionRecord,
  reconcileSearchDocuments,
  semanticIndexVersion,
  versionedNamespace,
  type FoodSearchDocument,
  type IndexLifecycleConfig,
} from '../modules/foodItems/retrieval/index-lifecycle.js';

function readGlobalDocuments(value: unknown): FoodSearchDocument[] {
  if (!Array.isArray(value)) throw new Error('Documents JSON must be an array');
  return value.map((document, index) => {
    if (typeof document !== 'object' || document === null)
      throw new Error(`Document ${index} is not an object`);
    const record = document as Record<string, unknown>;
    if (record.sourceType !== 'app_owned') {
      throw new Error(
        `Document ${index} is not an app-owned global/reference FoodItem`,
      );
    }
    if (
      'userId' in record ||
      'ownerUserId' in record ||
      'private' in record ||
      'userSpecific' in record
    ) {
      throw new Error(`Document ${index} contains private-user metadata`);
    }
    if (
      typeof record.id !== 'string' ||
      typeof record.text !== 'string' ||
      (record.rankingClass !== 'reference' &&
        record.rankingClass !== 'app_curated')
    ) {
      throw new Error(`Document ${index} has invalid global search metadata`);
    }
    return record as unknown as FoodSearchDocument;
  });
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (inputPath === undefined)
    throw new Error('Usage: reindex-food-search <documents.json>');
  const documents = readGlobalDocuments(
    JSON.parse(await readFile(inputPath, 'utf8')) as unknown,
  );
  const required = ['PINECONE_API_KEY', 'PINECONE_INDEX_HOST'];
  for (const key of required)
    if (!process.env[key]) throw new Error(`${key} is required`);
  const candidateNamespace = versionedNamespace(
    process.env.PINECONE_CANDIDATE_NAMESPACE ?? 'food-search-next',
  );
  const config: IndexLifecycleConfig = {
    apiKey: process.env.PINECONE_API_KEY ?? '',
    indexHost: process.env.PINECONE_INDEX_HOST ?? '',
    activeNamespace: process.env.PINECONE_ACTIVE_NAMESPACE ?? 'food-search-v1',
    candidateNamespace,
    timeoutMs: 5000,
  };
  const eligibleDocuments = documents.filter(
    (document) =>
      document.rankingClass === 'reference' ||
      document.rankingClass === 'app_curated',
  );
  const indexVersion = semanticIndexVersion();
  const versionKey = {
    indexVersion,
    namespace: config.candidateNamespace,
  };
  const versionRecord = buildIndexVersionRecord({
    namespace: config.candidateNamespace,
    documentCount: eligibleDocuments.length,
    status: 'building',
  });
  await prisma.foodSearchIndexVersion.upsert({
    where: { indexVersion_namespace: versionKey },
    create: versionRecord,
    update: {
      embeddingModel: versionRecord.embeddingModel,
      documentFormat: versionRecord.documentFormat,
      status: 'building',
      documentCount: eligibleDocuments.length,
      activatedAt: null,
      retiredAt: null,
    },
  });
  let reconciliation;
  try {
    reconciliation = await reconcileSearchDocuments({
      config,
      documents: eligibleDocuments,
    });
  } catch (error) {
    await prisma.foodSearchIndexVersion.update({
      where: { indexVersion_namespace: versionKey },
      data: { status: 'failed' },
    });
    throw error;
  }
  const activate = process.argv.includes('--activate');
  if (activate) {
    await prisma.$transaction([
      prisma.foodSearchIndexVersion.updateMany({
        where: {
          status: 'active',
          NOT: [
            {
              indexVersion: versionKey.indexVersion,
              namespace: versionKey.namespace,
            },
          ],
        },
        data: { status: 'retired', retiredAt: new Date() },
      }),
      prisma.foodSearchIndexVersion.update({
        where: { indexVersion_namespace: versionKey },
        data: {
          status: 'active',
          documentCount: reconciliation.indexed,
          activatedAt: new Date(),
        },
      }),
    ]);
  } else {
    await prisma.foodSearchIndexVersion.update({
      where: { indexVersion_namespace: versionKey },
      data: { status: 'ready', documentCount: reconciliation.indexed },
    });
  }
  console.log(
    JSON.stringify({
      indexed: reconciliation.indexed,
      staleDeleted: reconciliation.staleDeleted,
      namespace: config.candidateNamespace,
      indexVersion: semanticIndexVersion(),
      activeNamespace: config.activeNamespace,
      activated: activate,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
