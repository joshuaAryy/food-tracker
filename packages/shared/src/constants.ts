export const API_BASE_PATH = '/api/v1';
export const DEFAULT_TIMEZONE = 'America/Toronto';
export const MOCK_USER_ID = '00000000-0000-4000-8000-000000000001';
export const PHOTO_ANALYSIS_JPEG_MIME_TYPE = 'image/jpeg';
export const PHOTO_ANALYSIS_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_ANALYSIS_MAX_ITEMS = 8;
export const PHOTO_CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export const PHOTO_QUANTITY_STATES = [
  'estimated',
  'no_responsible_estimate',
] as const;
export const PHOTO_QUANTITY_UNITS = [
  'count',
  'slice',
  'piece',
  'tablespoon',
  'teaspoon',
  'cup',
  'millilitre',
  'gram',
  'ounce',
] as const;
export const PHOTO_REPRESENTATION_MODES = ['decomposed', 'composite'] as const;
export const PHOTO_REPRESENTATION_KINDS = ['component', 'composite'] as const;
export const PHOTO_REPRESENTATION_OVERLAP_STATUSES = [
  'non_overlapping',
  'uncertain',
] as const;
export const PHOTO_ANALYSIS_MAX_GROUPS = PHOTO_ANALYSIS_MAX_ITEMS;
export const PHOTO_ANALYSIS_MAX_PROVIDER_ITEMS = 10;
export const PHOTO_ANALYSIS_MAX_COVERAGE_LABELS = 8;
export const PHOTO_CANDIDATE_ADJUDICATION_MAX_CANDIDATES = 3;
export const PHOTO_CANDIDATE_ADJUDICATION_MAX_ROWS = PHOTO_ANALYSIS_MAX_ITEMS;
export const PHOTO_CANDIDATE_ADJUDICATION_MAX_OUTPUT_TOKENS = 1024;
export const PHOTO_NUTRITION_ESTIMATE_MAX_CALORIES = 5000;
export const PHOTO_NUTRITION_ESTIMATE_MAX_MACRO_GRAMS = 500;
export const PHOTO_NUTRITION_ESTIMATE_ENERGY_TOLERANCE_RATIO = 0.4;
export const PHOTO_NUTRITION_ESTIMATE_ENERGY_TOLERANCE_KCAL = 150;
