import ExcelJS from 'exceljs';
import {
  deterministicRecordHash,
  dedupeAliases,
  normalizeDisplayName,
  parseNullableNumber,
  type NormalizedProviderNutrient,
  type NormalizedProviderFood,
} from './normalized.js';
import { mapProviderNutrient } from './nutrient-mapping.js';

function unitFromHeader(header: string): string {
  const match =
    header.match(/\((kcal|kj|mg|mcg|µg|ug|g)\)/i) ??
    header.match(/\b(kcal|kj|mg|mcg|µg|ug|g)\b/i);
  if (match === null) return 'g';
  return match[1]?.toLocaleLowerCase() ?? 'g';
}

function recordValue(
  record: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== '')
      return String(value).trim();
  }
  return '';
}

function rowRecords(worksheet: ExcelJS.Worksheet): {
  headers: string[];
  records: Record<string, unknown>[];
} {
  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, column) => {
    headers[column - 1] = String(cell.value ?? '').trim();
  });
  const records: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record = Object.fromEntries(
      headers
        .map((header, index) => [header, row.getCell(index + 1).value] as const)
        .filter(([header]) => header.length > 0),
    );
    if (recordValue(record, ['Food Code', 'FoodCode', 'Code']))
      records.push(record);
  });
  return { headers, records };
}

export async function parseCofid(
  workbookBuffer: Buffer,
  release = '2021',
): Promise<NormalizedProviderFood[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(workbookBuffer as never);
  const nutrientSheets = workbook.worksheets.filter((sheet) =>
    /^1\.(3|4|5|6|7|8|9|10|11|12|13|14)\b/.test(sheet.name),
  );
  const foodByCode = new Map<
    string,
    { name: string; description: string | null; group: string | null }
  >();
  const nutrientByFood = new Map<
    string,
    Map<string, NormalizedProviderNutrient>
  >();

  for (const worksheet of nutrientSheets) {
    const { headers, records } = rowRecords(worksheet);
    for (const record of records) {
      const sourceId = recordValue(record, ['Food Code', 'FoodCode', 'Code']);
      if (!sourceId) continue;
      if (!foodByCode.has(sourceId)) {
        foodByCode.set(sourceId, {
          name: normalizeDisplayName(
            recordValue(record, ['Food Name', 'FoodName', 'Name']),
          ),
          description: recordValue(record, ['Description']) || null,
          group: recordValue(record, ['Group']) || null,
        });
      }
      const nutrientMap =
        nutrientByFood.get(sourceId) ??
        new Map<string, NormalizedProviderNutrient>();
      for (const header of headers) {
        if (
          !header ||
          [
            'Food Code',
            'Food Name',
            'Description',
            'Group',
            'Previous',
            'Main data references',
            'Footnote',
          ].includes(header)
        )
          continue;
        const mapped = mapProviderNutrient(
          header,
          record[header],
          unitFromHeader(header),
        );
        if (mapped !== null && !nutrientMap.has(mapped.key))
          nutrientMap.set(mapped.key, mapped);
      }
      nutrientByFood.set(sourceId, nutrientMap);
    }
  }

  return [...foodByCode.entries()].flatMap(([sourceId, food]) => {
    if (!food.name || /^old\s+foods?/i.test(food.name)) return [];
    const nutrients = [...(nutrientByFood.get(sourceId)?.values() ?? [])];
    const aliases = dedupeAliases(food.name, []);
    return [
      {
        provider: 'cofid',
        release,
        sourceId,
        name: food.name,
        authoritativeAliases: aliases,
        brandName: null,
        foodType: 'generic' as const,
        category: food.group,
        preparation: food.description,
        region: 'GB',
        servingQuantity: 100,
        servingUnit: 'g',
        servingWeightGrams: parseNullableNumber(100),
        nutrients,
        sourceRecordHash: deterministicRecordHash({
          provider: 'cofid',
          release,
          sourceId,
          food,
          nutrients,
        }),
      } satisfies NormalizedProviderFood,
    ];
  });
}
