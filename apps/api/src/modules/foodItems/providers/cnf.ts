import { parse } from 'csv-parse/sync';
import {
  deterministicRecordHash,
  dedupeAliases,
  normalizeDisplayName,
  parseNullableNumber,
  type NormalizedProviderFood,
} from './normalized.js';
import { mapProviderNutrient } from './nutrient-mapping.js';

export interface CnfCsvInput {
  foods: string;
  nutrients: string;
  foodNutrients: string;
  measures?: string;
}

function rows(csv: string): Record<string, string>[] {
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];
}

function value(row: Record<string, string>, keys: readonly string[]): string {
  for (const key of keys) {
    const found = row[key];
    if (found !== undefined && found.trim() !== '') return found;
  }
  return '';
}

export function parseCnfCsv(
  input: CnfCsvInput,
  release = '2026',
): NormalizedProviderFood[] {
  const foods = rows(input.foods);
  const nutrientLabels = new Map(
    rows(input.nutrients).map((row) => [
      value(row, ['NutrientID', 'Nutrient_Code', 'nutrient_id', 'ID']),
      {
        label: value(row, [
          'NutrientName',
          'Nutrient_Name',
          'Nutrient_Name_EN',
          'nutrient_name',
          'Name',
        ]),
        unit: value(row, ['Nutrient_Unit', 'Unit', 'NutrientUnit']),
      },
    ]),
  );
  const nutrientRows = rows(input.foodNutrients);
  const measureRows = input.measures === undefined ? [] : rows(input.measures);
  const measuresByFood = new Map<string, Record<string, string>[]>();
  for (const row of measureRows) {
    const id = value(row, ['Food_Code', 'FoodID', 'FoodCode', 'food_code']);
    if (!id) continue;
    const existing = measuresByFood.get(id) ?? [];
    existing.push(row);
    measuresByFood.set(id, existing);
  }
  const byFood = new Map<string, typeof nutrientRows>();
  for (const row of nutrientRows) {
    const id = value(row, [
      'FoodID',
      'Food_Code',
      'food_id',
      'FoodCode',
      'food_code',
    ]);
    const existing = byFood.get(id) ?? [];
    existing.push(row);
    byFood.set(id, existing);
  }
  return foods.flatMap((row) => {
    const sourceId = value(row, [
      'FoodID',
      'Food_Code',
      'food_id',
      'FoodCode',
      'food_code',
    ]).trim();
    const name = normalizeDisplayName(
      value(row, [
        'FoodName',
        'Food_Name',
        'Food_Description_EN',
        'food_name',
      ]).trim(),
    );
    if (!sourceId || !name) return [];
    const nutrients = (byFood.get(sourceId) ?? []).flatMap((nutrientRow) => {
      const nutrientCode = value(nutrientRow, [
        'NutrientID',
        'Nutrient_Code',
        'nutrient_id',
        'NutrientCode',
      ]);
      const labelRecord = nutrientLabels.get(nutrientCode);
      const label =
        labelRecord?.label ??
        value(nutrientRow, ['NutrientName', 'Nutrient_Name', 'nutrient_name']);
      const mapped = mapProviderNutrient(
        label,
        value(nutrientRow, ['Amount', 'Nutrient_Amount', 'Value', 'amount']),
        value(nutrientRow, [
          'Unit',
          'Nutrient_Unit',
          'Nutrient_Unit_EN',
          'unit',
        ]) ||
          labelRecord?.unit ||
          'g',
      );
      return mapped === null ? [] : [mapped];
    });
    const aliases = dedupeAliases(name, [
      value(row, [
        'FrenchName',
        'Food_Name_French',
        'FoodNameFrench',
        'Food_Description_FR',
      ]),
      value(row, ['AlternateName', 'Food_Name_Alternate']),
      value(row, ['FoodNameFrench', 'Food_Name_French', 'Food_Description_FR']),
    ]);
    const measure = (measuresByFood.get(sourceId) ?? []).find((candidate) => {
      const grams = parseNullableNumber(
        value(candidate, ['Gram_Weight', 'Measure_Weight', 'Weight_Grams']),
      );
      return grams !== null && grams > 0;
    });
    const measureWeight =
      measure === undefined
        ? null
        : parseNullableNumber(
            value(measure, ['Gram_Weight', 'Measure_Weight', 'Weight_Grams']),
          );
    const record = {
      provider: 'cnf',
      release,
      sourceId,
      name,
      aliases,
      row,
      nutrients,
    };
    return [
      {
        provider: 'cnf',
        release,
        sourceId,
        name,
        authoritativeAliases: aliases,
        brandName: null,
        foodType: 'generic',
        category: value(row, ['FoodGroup', 'Food_Group']) || null,
        preparation: value(row, ['Preparation', 'preparation']) || null,
        region: 'CA',
        servingQuantity:
          parseNullableNumber(
            value(row, ['ServingQuantity', 'MeasureQuantity']),
          ) ?? (measureWeight === null ? null : 1),
        servingUnit:
          value(row, ['ServingUnit', 'MeasureUnit']) ||
          (measure === undefined
            ? 'g'
            : value(measure, ['Measure_Name', 'MeasureName']) || 'g'),
        servingWeightGrams:
          parseNullableNumber(
            value(row, ['ServingWeightGrams', 'GramWeight']),
          ) ?? measureWeight,
        nutrients,
        sourceRecordHash: deterministicRecordHash(record),
      } satisfies NormalizedProviderFood,
    ];
  });
}
