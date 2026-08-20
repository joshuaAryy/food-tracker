import type { AnalyticsMetricKey } from '@food-tracker/shared';
import { colors } from '../../theme/tokens';

export type AnalyticsChartStyleFamily =
  | 'energy'
  | 'protein'
  | 'carbohydrate'
  | 'fat'
  | 'limit'
  | 'vitamin'
  | 'mineral'
  | 'hydration'
  | 'body'
  | 'behavior'
  | 'fallback';

export interface AnalyticsChartStyle {
  family: AnalyticsChartStyleFamily;
  raw: { fill: string; stroke: string; opacity: number; strokeWidth: number };
  trend: { color: string; width: number };
  reference: { color: string; opacity: number; strokeWidth: number };
  referenceTreatment: 'none' | 'line' | 'bounds';
  selected: { fill: string; stroke: string; opacity: number };
  tooltipAccent: string;
}

const STYLE_BY_FAMILY: Record<AnalyticsChartStyleFamily, AnalyticsChartStyle> =
  {
    energy: {
      family: 'energy',
      raw: {
        fill: colors.light.primarySoft,
        stroke: '#C9C9C2',
        opacity: 0.72,
        strokeWidth: 1,
      },
      trend: { color: colors.light.ink, width: 2.75 },
      reference: { color: colors.light.ink, opacity: 0.42, strokeWidth: 1.25 },
      referenceTreatment: 'bounds',
      selected: {
        fill: colors.light.ink,
        stroke: colors.light.ink,
        opacity: 1,
      },
      tooltipAccent: colors.light.ink,
    },
    protein: {
      family: 'protein',
      raw: {
        fill: colors.light.sageSoft,
        stroke: '#AFC3AA',
        opacity: 0.72,
        strokeWidth: 1,
      },
      trend: { color: colors.light.sageDark, width: 2.75 },
      reference: {
        color: colors.light.sageDark,
        opacity: 0.42,
        strokeWidth: 1.25,
      },
      referenceTreatment: 'line',
      selected: {
        fill: colors.light.sageDark,
        stroke: colors.light.sageDark,
        opacity: 1,
      },
      tooltipAccent: colors.light.sageDark,
    },
    carbohydrate: {
      family: 'carbohydrate',
      raw: {
        fill: colors.light.carbsSoft,
        stroke: '#D5C18C',
        opacity: 0.72,
        strokeWidth: 1,
      },
      trend: { color: colors.light.carbs, width: 2.75 },
      reference: {
        color: colors.light.carbs,
        opacity: 0.42,
        strokeWidth: 1.25,
      },
      referenceTreatment: 'line',
      selected: {
        fill: colors.light.carbs,
        stroke: colors.light.carbs,
        opacity: 1,
      },
      tooltipAccent: colors.light.carbs,
    },
    fat: {
      family: 'fat',
      raw: {
        fill: colors.light.fatSoft,
        stroke: '#D0AE9E',
        opacity: 0.72,
        strokeWidth: 1,
      },
      trend: { color: colors.light.fat, width: 2.75 },
      reference: { color: colors.light.fat, opacity: 0.42, strokeWidth: 1.25 },
      referenceTreatment: 'line',
      selected: {
        fill: colors.light.fat,
        stroke: colors.light.fat,
        opacity: 1,
      },
      tooltipAccent: colors.light.fat,
    },
    limit: {
      family: 'limit',
      raw: {
        fill: colors.light.errorSoft,
        stroke: '#D2A39C',
        opacity: 0.72,
        strokeWidth: 1,
      },
      trend: { color: colors.light.error, width: 2.75 },
      reference: {
        color: colors.light.error,
        opacity: 0.42,
        strokeWidth: 1.25,
      },
      referenceTreatment: 'line',
      selected: {
        fill: colors.light.error,
        stroke: colors.light.error,
        opacity: 1,
      },
      tooltipAccent: colors.light.error,
    },
    vitamin: {
      family: 'vitamin',
      raw: {
        fill: '#D2D7E1',
        stroke: '#C4CBD7',
        opacity: 0.72,
        strokeWidth: 1,
      },
      trend: { color: '#5766C7', width: 2.75 },
      reference: { color: '#5766C7', opacity: 0.42, strokeWidth: 1.25 },
      referenceTreatment: 'bounds',
      selected: { fill: '#5766C7', stroke: '#5766C7', opacity: 1 },
      tooltipAccent: '#5766C7',
    },
    mineral: {
      family: 'mineral',
      raw: {
        fill: '#D5DFDA',
        stroke: '#B8C8C0',
        opacity: 0.72,
        strokeWidth: 1,
      },
      trend: { color: '#4E7664', width: 2.75 },
      reference: { color: '#4E7664', opacity: 0.42, strokeWidth: 1.25 },
      referenceTreatment: 'line',
      selected: { fill: '#4E7664', stroke: '#4E7664', opacity: 1 },
      tooltipAccent: '#4E7664',
    },
    hydration: {
      family: 'hydration',
      raw: {
        fill: colors.light.waterSoft,
        stroke: '#A4BBC7',
        opacity: 0.72,
        strokeWidth: 1,
      },
      trend: { color: colors.light.water, width: 2.75 },
      reference: {
        color: colors.light.water,
        opacity: 0.42,
        strokeWidth: 1.25,
      },
      referenceTreatment: 'line',
      selected: {
        fill: colors.light.water,
        stroke: colors.light.water,
        opacity: 1,
      },
      tooltipAccent: colors.light.water,
    },
    body: {
      family: 'body',
      raw: {
        fill: colors.light.sageSoft,
        stroke: '#B4C8AE',
        opacity: 0.72,
        strokeWidth: 1,
      },
      trend: { color: '#789776', width: 2.75 },
      reference: { color: '#789776', opacity: 0.42, strokeWidth: 1.25 },
      referenceTreatment: 'line',
      selected: { fill: '#789776', stroke: '#789776', opacity: 1 },
      tooltipAccent: '#789776',
    },
    behavior: {
      family: 'behavior',
      raw: {
        fill: colors.light.sageSoft,
        stroke: '#AFC3AA',
        opacity: 0.72,
        strokeWidth: 1,
      },
      trend: { color: colors.light.sageDark, width: 2.75 },
      reference: {
        color: colors.light.sageDark,
        opacity: 0.42,
        strokeWidth: 1.25,
      },
      referenceTreatment: 'none',
      selected: {
        fill: colors.light.sageDark,
        stroke: colors.light.sageDark,
        opacity: 1,
      },
      tooltipAccent: colors.light.sageDark,
    },
    fallback: {
      family: 'fallback',
      raw: {
        fill: colors.light.moduleMuted,
        stroke: colors.light.border,
        opacity: 0.68,
        strokeWidth: 1,
      },
      trend: { color: colors.light.muted, width: 2.5 },
      reference: { color: colors.light.muted, opacity: 0.35, strokeWidth: 1 },
      referenceTreatment: 'line',
      selected: {
        fill: colors.light.muted,
        stroke: colors.light.muted,
        opacity: 1,
      },
      tooltipAccent: colors.light.muted,
    },
  };

const FAMILY_BY_METRIC: Record<AnalyticsMetricKey, AnalyticsChartStyleFamily> =
  {
    calories: 'energy',
    protein: 'protein',
    carbs: 'carbohydrate',
    fat: 'fat',
    fiber: 'carbohydrate',
    sugar: 'limit',
    sodium: 'limit',
    addedSugar: 'limit',
    starch: 'carbohydrate',
    solubleFiber: 'carbohydrate',
    insolubleFiber: 'carbohydrate',
    sugarAlcohol: 'carbohydrate',
    saturatedFat: 'fat',
    transFat: 'limit',
    monounsaturatedFat: 'fat',
    polyunsaturatedFat: 'fat',
    omega3: 'fat',
    omega6: 'fat',
    cholesterol: 'limit',
    histidine: 'protein',
    isoleucine: 'protein',
    leucine: 'protein',
    lysine: 'protein',
    methionine: 'protein',
    phenylalanine: 'protein',
    threonine: 'protein',
    tryptophan: 'protein',
    valine: 'protein',
    alanine: 'protein',
    arginine: 'protein',
    asparticAcid: 'protein',
    cystine: 'protein',
    glutamicAcid: 'protein',
    glycine: 'protein',
    proline: 'protein',
    serine: 'protein',
    tyrosine: 'protein',
    potassium: 'mineral',
    caffeine: 'limit',
    alcohol: 'limit',
    oxalate: 'limit',
    phytate: 'limit',
    vitaminA: 'vitamin',
    thiamine: 'vitamin',
    riboflavin: 'vitamin',
    niacin: 'vitamin',
    pantothenicAcid: 'vitamin',
    vitaminB6: 'vitamin',
    biotin: 'vitamin',
    folate: 'vitamin',
    vitaminB12: 'vitamin',
    vitaminC: 'vitamin',
    vitaminD: 'vitamin',
    vitaminE: 'vitamin',
    vitaminK: 'vitamin',
    calcium: 'mineral',
    iron: 'mineral',
    magnesium: 'mineral',
    zinc: 'mineral',
    phosphorus: 'mineral',
    selenium: 'mineral',
    copper: 'mineral',
    manganese: 'mineral',
    iodine: 'mineral',
    chromium: 'mineral',
    molybdenum: 'mineral',
    chloride: 'mineral',
    macroComposition: 'fallback',
    weight: 'body',
    loggingConsistency: 'behavior',
    hydration: 'hydration',
  };

export function chartStyleForMetric(
  metric: AnalyticsMetricKey,
): AnalyticsChartStyle {
  return STYLE_BY_FAMILY[FAMILY_BY_METRIC[metric] ?? 'fallback'];
}
