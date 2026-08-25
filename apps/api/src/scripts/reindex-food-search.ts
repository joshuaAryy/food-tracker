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
import {
  buildGlobalSearchDocuments,
  globalSearchFoodWhere,
} from '../modules/foodItems/retrieval/global-scope.js';

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
    if (
      record.sourceProvider === 'open_food_facts' ||
      record.sourceProvider === 'usda_fdc'
    ) {
      throw new Error(
        `Document ${index} is a cached external food excluded from the global index`,
      );
    }
    return record as unknown as FoodSearchDocument;
  });
}

async function readDatabaseDocuments(): Promise<FoodSearchDocument[]> {
  const foods = await prisma.foodItem.findMany({
    where: globalSearchFoodWhere(),
    select: {
      id: true,
      name: true,
      brandName: true,
      sourceAliases: true,
      searchText: true,
      sourceProvider: true,
      sourceRegion: true,
      sourceType: true,
      rankingClass: true,
      datasetRelease: true,
      userId: true,
      archivedAt: true,
      barcodes: { select: { id: true } },
    },
  });
  return buildGlobalSearchDocuments(foods);
}

async function readDocuments(): Promise<FoodSearchDocument[]> {
  const args = process.argv.slice(2);
  const jsonFlag = args.indexOf('--json');
  const jsonPath = jsonFlag >= 0 ? args[jsonFlag + 1] : undefined;
  if (jsonFlag >= 0 && jsonPath === undefined)
    throw new Error('Usage: food:reindex [--json documents.json] [--activate]');
  const positionalPath = args.find((argument) => !argument.startsWith('--'));
  const inputPath = jsonPath ?? positionalPath;
  if (inputPath === undefined) return readDatabaseDocuments();
  return readGlobalDocuments(
    JSON.parse(await readFile(inputPath, 'utf8')) as unknown,
  );
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(
      'Usage: food:reindex [--activate] [--json documents.json]\n' +
        'Without --json, derive eligible global search documents from PostgreSQL.',
    );
    return;
  }
  const documents = await readDocuments();
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
