import { prisma } from '../lib/prisma.js';
import { seedBenchmarkCatalog } from '../benchmarks/food-retrieval/seed.js';

function assertTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) throw new Error('DATABASE_URL is required');
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing benchmark seed database "${databaseName}"; it must end in _test.`,
    );
  }
}

assertTestDatabase();
seedBenchmarkCatalog(prisma)
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
