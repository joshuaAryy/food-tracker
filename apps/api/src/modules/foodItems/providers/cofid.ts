import ExcelJS from 'exceljs';
import {
  deterministicRecordHash,
  dedupeAliases,
  normalizeDisplayName,
  parseNullableNumber,
  type NormalizedProviderFood,
} from './normalized.js';
import { mapProviderNutrient } from './nutrient-mapping.js';

export async function parseCofid(
  workbookBuffer: Buffer,
  release = '2021',
): Promise<NormalizedProviderFood[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(workbookBuffer as never);
  const worksheet =
    workbook.worksheets.find((sheet) => /food|cofid/i.test(sheet.name)) ??
    workbook.worksheets[0];
  if (worksheet === undefined)
    throw new Error('CoFID workbook has no worksheet');
  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, column) => {
    headers[column - 1] = String(cell.value ?? '').trim();
  });
  const result: NormalizedProviderFood[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record = Object.fromEntries(
      headers.map((header, index) => [header, row.getCell(index + 1).value]),
    );
    const sourceId = String(
      record['Food Code'] ?? record.FoodCode ?? record.Code ?? '',
    ).trim();
    const name = normalizeDisplayName(
      String(
        record['Food Name'] ?? record.FoodName ?? record.Name ?? '',
      ).trim(),
    );
    if (!sourceId || !name) return;
    const nutrients = headers.flatMap((header) => {
      const mapped = mapProviderNutrient(header, record[header], 'g');
      return mapped === null ? [] : [mapped];
    });
    const aliases = dedupeAliases(name, [
      record['Food Name (alternate)'] as string | undefined,
    ]);
    result.push({
      provider: 'cofid',
      release,
      sourceId,
      name,
      authoritativeAliases: aliases,
      brandName: null,
      foodType: 'generic',
      category: String(record.Group ?? '') || null,
      preparation: null,
      region: 'GB',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams:
        parseNullableNumber(record['Edible Portion (g)']) ?? 100,
      nutrients,
      sourceRecordHash: deterministicRecordHash({
        sourceId,
        record,
        nutrients,
      }),
    });
  });
  return result;
}
