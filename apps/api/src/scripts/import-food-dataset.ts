import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { parseCnfCsv } from '../modules/foodItems/providers/cnf.js';
import { parseCiqual } from '../modules/foodItems/providers/ciqual.js';
import { parseCofid } from '../modules/foodItems/providers/cofid.js';
import { persistProviderFoods } from '../modules/foodItems/providers/importer.js';
import { manifestFor } from '../modules/foodItems/providers/manifest.js';

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = process.argv[index + 1];
  if (index < 0 || value === undefined) throw new Error(`Missing ${name}`);
  return value;
}

function optionalArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : (process.argv[index + 1] ?? null);
}

async function main(): Promise<void> {
  const provider = arg('--provider') as 'cnf' | 'ciqual' | 'cofid';
  const release = arg('--release');
  const sourceUri = arg('--source-uri');
  const inputPath = arg('--input');
  const artifactPath = optionalArg('--artifact') ?? inputPath;
  const sha256 = createHash('sha256')
    .update(await readFile(artifactPath))
    .digest('hex');
  const manifest = manifestFor(provider, release);
  if (sourceUri !== manifest.sourceUrl || sha256 !== manifest.artifactSha256) {
    throw new Error(
      `Pinned manifest mismatch for ${provider} ${release}; refusing import.`,
    );
  }
  const dryRun = process.argv.includes('--dry-run');
  let rows;
  if (provider === 'cnf') {
    const foods = await readFile(inputPath, 'utf8');
    const nutrients = await readFile(arg('--nutrients'), 'utf8');
    const foodNutrients = await readFile(arg('--food-nutrients'), 'utf8');
    const measuresPath = optionalArg('--measures');
    const measureNamesPath = optionalArg('--measure-names');
    rows = parseCnfCsv(
      {
        foods,
        nutrients,
        foodNutrients,
        ...(measuresPath === null
          ? {}
          : { measures: await readFile(measuresPath, 'utf8') }),
        ...(measureNamesPath === null
          ? {}
          : { measureNames: await readFile(measureNamesPath, 'utf8') }),
      },
      release,
    );
  } else if (provider === 'ciqual') {
    const metadataPath = arg('--metadata-xml');
    const metadataXml = await readFile(metadataPath, 'utf8');
    if (manifest.companionArtifactSha256 !== undefined) {
      const metadataSha256 = createHash('sha256')
        .update(metadataXml)
        .digest('hex');
      if (metadataSha256 !== manifest.companionArtifactSha256) {
        throw new Error(
          `Pinned companion manifest mismatch for ${provider} ${release}; refusing import.`,
        );
      }
    }
    rows = await parseCiqual({
      compositionXlsx: await readFile(inputPath),
      metadataXml,
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
