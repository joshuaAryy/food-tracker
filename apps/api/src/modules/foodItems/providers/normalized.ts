import { createHash } from 'node:crypto';
import { normalizeFoodIdentityText } from '../text-normalization.js';

export type BulkProvider = 'cnf' | 'ciqual' | 'cofid';
export type CanonicalNutrientUnit = 'kcal' | 'g' | 'mg' | 'mcg';

export interface NormalizedProviderNutrient {
  key: string;
  amount: number;
  unit: CanonicalNutrientUnit;
  sourceLabel: string;
  sourceUnit: string;
  sourceValue: string;
}

export interface NormalizedProviderFood {
  provider: BulkProvider;
  release: string;
  sourceId: string;
  name: string;
  authoritativeAliases: readonly string[];
  brandName: string | null;
  foodType: 'generic' | 'branded';
  category: string | null;
  preparation: string | null;
  region: string | null;
  servingQuantity: number | null;
  servingUnit: string | null;
  servingWeightGrams: number | null;
  nutrients: readonly NormalizedProviderNutrient[];
  sourceRecordHash: string;
}

export function deterministicRecordHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function normalizeDisplayName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function normalizeIdentityText(value: string): string {
  return normalizeFoodIdentityText(value);
}

export function dedupeAliases(
  canonicalName: string,
  aliases: readonly (string | null | undefined)[],
): string[] {
  const seen = new Set([normalizeIdentityText(canonicalName)]);
  const result: string[] = [];
  for (const alias of aliases) {
    if (alias === null || alias === undefined) continue;
    const display = normalizeDisplayName(alias);
    const identity = normalizeIdentityText(display);
    if (display.length === 0 || seen.has(identity)) continue;
    seen.add(identity);
    result.push(display);
  }
  return result;
}

export function providerSearchText(input: {
  name: string;
  authoritativeAliases: readonly string[];
  brandName: string | null;
  category: string | null;
  preparation: string | null;
}): string {
  return [
    input.name,
    ...input.authoritativeAliases,
    input.brandName,
    input.category,
    input.preparation,
  ]
    .filter((value): value is string => value !== null && value.trim() !== '')
    .map(normalizeIdentityText)
    .join(' ');
}

export function parseNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(',', '.');
  if (normalized.length === 0 || /^(tr|n|nd|--|na)$/i.test(normalized))
    return null;
  const parsed = Number(normalized.replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}
