import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { parseCnfCsv } from '../modules/foodItems/providers/cnf.js';
import { parseCiqual } from '../modules/foodItems/providers/ciqual.js';
import { parseCofid } from '../modules/foodItems/providers/cofid.js';
import { persistProviderFoods } from '../modules/foodItems/providers/importer.js';

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = process.argv[index + 1];
  if (index < 0 || value === undefined) throw new Error(`Missing ${name}`);
  return value;
}

async function main(): Promise<void> {
  const provider = arg('--provider') as 'cnf' | 'ciqual' | 'cofid';
  const release = arg('--release');
  const sourceUri = arg('--source-uri');
  const inputPath = arg('--input');
  const sha256 = createHash('sha256')
    .update(await readFile(inputPath))
    .digest('hex');
  const dryRun = process.argv.includes('--dry-run');
  let rows;
  if (provider === 'cnf') {
    const foods = await readFile(inputPath, 'utf8');
    const nutrients = await readFile(arg('--nutrients'), 'utf8');
    const foodNutrients = await readFile(arg('--food-nutrients'), 'utf8');
    rows = parseCnfCsv({ foods, nutrients, foodNutrients }, release);
  } else if (provider === 'ciqual') {
    rows = await parseCiqual({
      compositionXlsx: await readFile(inputPath),
      metadataXml: await readFile(arg('--metadata-xml'), 'utf8'),
      release,
    });
  } else {
    rows = await parseCofid(await readFile(inputPath), release);
  }
  const result = await persistProviderFoods({
    prisma,
    rows,
    sourceUri,
    sourceSha256: sha256,
    dryRun,
  });
  console.log(JSON.stringify(result));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
