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

export function parseCnfCsv(
  input: CnfCsvInput,
  release = '2026',
): NormalizedProviderFood[] {
  const foods = rows(input.foods);
  const nutrientLabels = new Map(
    rows(input.nutrients).map((row) => [
      String(row.NutrientID ?? row.nutrient_id ?? row.ID),
      String(row.NutrientName ?? row.nutrient_name ?? row.Name),
    ]),
  );
  const nutrientRows = rows(input.foodNutrients);
  const byFood = new Map<string, typeof nutrientRows>();
  for (const row of nutrientRows) {
    const id = String(
      row.FoodID ?? row.food_id ?? row.FoodCode ?? row.food_code,
    );
    const existing = byFood.get(id) ?? [];
    existing.push(row);
    byFood.set(id, existing);
  }
  return foods.flatMap((row) => {
    const sourceId = String(
      row.FoodID ?? row.food_id ?? row.FoodCode ?? row.food_code ?? '',
    ).trim();
    const name = normalizeDisplayName(
      String(row.FoodName ?? row.Food_Name ?? row.food_name ?? '').trim(),
    );
    if (!sourceId || !name) return [];
    const nutrients = (byFood.get(sourceId) ?? []).flatMap((nutrientRow) => {
      const label =
        nutrientLabels.get(
          String(
            nutrientRow.NutrientID ??
              nutrientRow.nutrient_id ??
              nutrientRow.NutrientCode,
          ),
        ) ??
        String(nutrientRow.NutrientName ?? nutrientRow.nutrient_name ?? '');
      const mapped = mapProviderNutrient(
        label,
        nutrientRow.Amount ?? nutrientRow.Value ?? nutrientRow.amount,
        String(nutrientRow.Unit ?? nutrientRow.unit ?? ''),
      );
      return mapped === null ? [] : [mapped];
    });
    const aliases = dedupeAliases(name, [
      row.FrenchName,
      row.AlternateName,
      row.FoodNameFrench,
    ]);
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
        category: row.FoodGroup ?? row.Food_Group ?? null,
        preparation: row.Preparation ?? row.preparation ?? null,
        region: 'CA',
        servingQuantity: parseNullableNumber(
          row.ServingQuantity ?? row.MeasureQuantity,
        ),
        servingUnit: row.ServingUnit ?? row.MeasureUnit ?? 'g',
        servingWeightGrams: parseNullableNumber(
          row.ServingWeightGrams ?? row.GramWeight,
        ),
        nutrients,
        sourceRecordHash: deterministicRecordHash(record),
      } satisfies NormalizedProviderFood,
    ];
  });
}
