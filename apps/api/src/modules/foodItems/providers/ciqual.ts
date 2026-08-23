import ExcelJS from 'exceljs';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  deterministicRecordHash,
  dedupeAliases,
  normalizeDisplayName,
  type NormalizedProviderFood,
} from './normalized.js';
import { mapProviderNutrient } from './nutrient-mapping.js';

function unitFromHeader(header: string): string {
  const match = header.match(
    /(?:^|[^\p{L}])(kcal|kj|mg|mcg|µg|ug|g)(?=[^\p{L}]|$)/iu,
  );
  if (match === null) return 'g';
  return match[1]?.toLocaleLowerCase() ?? 'g';
}

export interface CiqualInput {
  compositionXlsx: Buffer;
  metadataXml: string;
  release?: string;
}

function xmlRows(
  xml: string,
): Map<string, { fr: string; eng: string; sci: string }> {
  if (XMLValidator.validate(xml) !== true)
    throw new Error('Ciqual metadata XML is invalid');
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  }).parse(xml) as Record<string, unknown>;
  const scalarText = (value: unknown): string => {
    if (typeof value === 'string' || typeof value === 'number')
      return String(value);
    if (typeof value !== 'object' || value === null) return '';
    const record = value as Record<string, unknown>;
    if (record.missing !== undefined) return '';
    return scalarText(record['#text'] ?? record.text);
  };
  const found = new Map<string, { fr: string; eng: string; sci: string }>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const record = value as Record<string, unknown>;
    if (record.alim_code !== undefined) {
      found.set(String(record.alim_code), {
        fr: scalarText(record.alim_nom_fr),
        eng: scalarText(record.alim_nom_eng),
        sci: scalarText(record.alim_nom_sci),
      });
    }
    Object.values(record).forEach(visit);
  };
  visit(parsed);
  return found;
}

export async function parseCiqual(
  input: CiqualInput,
): Promise<NormalizedProviderFood[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input.compositionXlsx as never);
  const worksheet = workbook.worksheets[0];
  if (worksheet === undefined)
    throw new Error('Ciqual workbook has no worksheet');
  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, column) => {
    headers[column - 1] = String(cell.value ?? '').trim();
  });
  const metadata = xmlRows(input.metadataXml);
  const result: NormalizedProviderFood[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = headers.map((_, index) => row.getCell(index + 1).value);
    const record = Object.fromEntries(
      headers.map((header, index) => [header, values[index]]),
    );
    const sourceId = String(
      record.alim_code ?? record.Aliment_code ?? record.code ?? '',
    ).trim();
    if (!sourceId) return;
    const names = metadata.get(sourceId) ?? {
      fr: String(record.alim_nom_fr ?? ''),
      eng: String(record.alim_nom_eng ?? ''),
      sci: String(record.alim_nom_sci ?? ''),
    };
    const name = normalizeDisplayName(names.eng || names.fr);
    if (!name) return;
    const aliases = dedupeAliases(name, [names.fr, names.sci]);
    const nutrientByKey = new Map<
      string,
      ReturnType<typeof mapProviderNutrient>
    >();
    for (const header of headers) {
      const mapped = mapProviderNutrient(
        header,
        record[header],
        unitFromHeader(header),
      );
      if (mapped !== null && !nutrientByKey.has(mapped.key)) {
        nutrientByKey.set(mapped.key, mapped);
      }
    }
    const nutrients = [...nutrientByKey.values()].filter(
      (nutrient): nutrient is NonNullable<typeof nutrient> => nutrient !== null,
    );
    result.push({
      provider: 'ciqual',
      release: input.release ?? '2025',
      sourceId,
      name,
      authoritativeAliases: aliases,
      brandName: null,
      foodType: 'generic',
      category: String(record.Groupe ?? record.group ?? '') || null,
      preparation: null,
      region: 'FR',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      nutrients,
      sourceRecordHash: deterministicRecordHash({
        sourceId,
        record,
        names,
        nutrients,
      }),
    });
  });
  return result;
}
