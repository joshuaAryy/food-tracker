import type {
  ApiResponse,
  AdvancedAnalytics,
  AiFoodParseCandidate,
  AiFoodParseResult,
  AiNutritionEstimateInput,
  AiNutritionEstimateResult,
  DashboardSummary,
  DailyNutrientTotals,
  FoodBarcodeLookupInput,
  FoodItem,
  FoodItemExternalCandidateInput,
  FoodItemInput,
  FoodItemSearchCandidatesInput,
  FoodLibraryQuery,
  FoodLibraryResponse,
  FoodItemDefaultServingInput,
  FoodLogSaveAsManualFoodInput,
  FoodLog,
  FoodLogFromAiEstimateInput,
  FoodLogsFromCandidatesInput,
  FoodLogFromFoodItemInput,
  FoodLogsFromFoodItemsInput,
  ManualFoodItemCreateInput,
  ManualFoodItemUpdateInput,
  MixedMealCreateInput,
  MixedMealPreviewInput,
  MixedMealPreviewResult,
  FoodLogInput,
  FoodLogUpdateInput,
  Goals,
  Profile,
  Recommendation,
  RecommendationStatus,
  Recipe,
  RecipeCreateInput,
  RecipeIngredientInput,
  RecipeLogInput,
  RecipeUpdateInput,
  SetupInput,
  SetupPreviewResult,
  SetupResult,
  SetupStatus,
  TrackingPreferences,
  WeightLog,
  WeightLogInput,
  PhotoAnalysisResult,
} from '@food-tracker/shared';
import {
  API_BASE_PATH,
  goalsSchema,
  profileSchema,
  setupPreviewResultSchema,
  setupResultSchema,
  setupStatusSchema,
  trackingPreferencesSchema,
  photoAnalysisResultSchema,
} from '@food-tracker/shared';
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import {
  photoAnalysisRequestInit,
  readNormalizedPhotoBytes,
  PhotoUploadError,
} from './photo-image-core';
import type { NormalizedPhotoImage } from './photo-image-core';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(
  /\/+$/,
  '',
);
export const API_URL =
  configuredApiUrl === undefined || configuredApiUrl === ''
    ? `http://localhost:3000${API_BASE_PATH}`
    : configuredApiUrl;

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

interface ResponseSchema<T> {
  safeParse: (
    value: unknown,
  ) => { success: true; data: T } | { success: false };
}

async function parseApiResponse<T>(
  response: Response,
  schema?: ResponseSchema<T>,
): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw invalidResponse(response.status);
  }

  if (!isRecord(payload) || typeof payload.success !== 'boolean') {
    throw invalidResponse(response.status);
  }

  const envelope = payload as unknown as ApiResponse<unknown>;
  if (!envelope.success) {
    if (
      !isRecord(envelope.error) ||
      typeof envelope.error.code !== 'string' ||
      typeof envelope.error.message !== 'string' ||
      !isRecord(envelope.error.details)
    ) {
      throw invalidResponse(response.status);
    }
    throw new ApiClientError(
      envelope.error.message,
      envelope.error.code,
      response.status,
      envelope.error.details,
    );
  }

  if (!response.ok) {
    throw new ApiClientError(
      `Request failed with status ${response.status}.`,
      'HTTP_ERROR',
      response.status,
    );
  }

  if (schema === undefined) return envelope.data as T;
  const parsed = schema.safeParse(envelope.data);
  if (!parsed.success) throw invalidResponse(response.status);
  return parsed.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function invalidResponse(status: number): ApiClientError {
  return new ApiClientError(
    'The API returned an unreadable or unexpected response.',
    'INVALID_RESPONSE',
    status,
  );
}

function apiConnectionMessage(): string {
  const base = `Could not reach the API at ${API_URL}. Confirm the API is running`;

  if (Platform.OS === 'web') {
    return `${base}.`;
  }

  return `${base}. On a physical device, set EXPO_PUBLIC_API_URL to http://<computer-LAN-IP>:3000/api/v1 before starting Expo; localhost refers to the device itself.`;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  schema?: ResponseSchema<T>,
): Promise<T> {
  const { body, headers: providedHeaders, ...requestOptions } = options;
  const headers = new Headers(providedHeaders);
  headers.set('Accept', 'application/json');
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const requestInit: RequestInit = {
    ...requestOptions,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, requestInit);
  } catch {
    throw new ApiClientError(apiConnectionMessage(), 'NETWORK_ERROR', 0);
  }

  return parseApiResponse(response, schema);
}

async function requestRaw<T>(
  path: string,
  body: ArrayBuffer,
  signal: AbortSignal,
  schema: ResponseSchema<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}${path}`,
      photoAnalysisRequestInit({ bytes: body, signal }),
    );
  } catch {
    if (signal.aborted) {
      throw new ApiClientError('Photo analysis was cancelled.', 'CANCELLED', 0);
    }
    throw new ApiClientError(apiConnectionMessage(), 'NETWORK_ERROR', 0);
  }
  return parseApiResponse(response, schema);
}

export const PHOTO_ANALYSIS_CLIENT_TIMEOUT_MS = 17_000;

export type PhotoAnalysisUpload = Pick<
  NormalizedPhotoImage,
  'uri' | 'mimeType' | 'byteSize'
>;

async function readLocalPhoto(
  photo: PhotoAnalysisUpload,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  try {
    const prepared = await readNormalizedPhotoBytes({
      ...photo,
      signal,
      openFile: (uri) => new File(uri),
    });
    return prepared.bytes.buffer as ArrayBuffer;
  } catch (cause) {
    if (cause instanceof PhotoUploadError) {
      if (cause.code === 'PHOTO_CANCELLED') {
        throw new ApiClientError(
          'Photo analysis was cancelled.',
          'CANCELLED',
          0,
        );
      }
      const messages: Record<PhotoUploadError['code'], string> = {
        PHOTO_UNSUPPORTED_TYPE: 'The prepared photo is not a JPEG. Try again.',
        PHOTO_FILE_UNAVAILABLE:
          'The prepared photo is no longer available. Choose the photo again.',
        PHOTO_FILE_READ_FAILED:
          'The prepared photo could not be read. Choose the photo again.',
        PHOTO_EMPTY: 'The prepared photo is empty. Choose the photo again.',
        PHOTO_TOO_LARGE:
          'The prepared photo is larger than 5 MiB. Choose another photo.',
        PHOTO_INVALID_JPEG:
          'The prepared photo is not a valid JPEG. Choose the photo again.',
        PHOTO_FILE_CHANGED:
          'The prepared photo changed before upload. Choose the photo again.',
        PHOTO_CANCELLED: 'Photo analysis was cancelled.',
      };
      throw new ApiClientError(messages[cause.code], cause.code, 0);
    }
    if (signal.aborted) {
      throw new ApiClientError('Photo analysis was cancelled.', 'CANCELLED', 0);
    }
    throw new ApiClientError(
      'The prepared photo could not be read. Choose the photo again.',
      'PHOTO_FILE_READ_FAILED',
      0,
    );
  }
}

export interface AdvancedAnalyticsQuery {
  date?: string;
  timezone?: string;
  rangeDays?: number;
}

export interface DailyNutrientTotalsQuery {
  date?: string;
}

interface FoodLogsQuery {
  date?: string;
  limit?: number;
}

interface FoodItemsQuery {
  query?: string;
  limit?: number;
  savedOnly?: boolean;
}

interface BarcodeLookupQuery {
  regionCode?: string;
}

interface WeightLogsQuery {
  date?: string;
}

function queryString(query: AdvancedAnalyticsQuery): string {
  const params = new URLSearchParams();
  if (query.date !== undefined) params.set('date', query.date);
  if (query.timezone !== undefined) params.set('timezone', query.timezone);
  if (query.rangeDays !== undefined) {
    params.set('rangeDays', String(query.rangeDays));
  }
  const value = params.toString();
  return value === '' ? '' : `?${value}`;
}

function foodLogsQueryString(query: FoodLogsQuery): string {
  const params = new URLSearchParams();
  if (query.date !== undefined) params.set('date', query.date);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const value = params.toString();
  return value === '' ? '' : `?${value}`;
}

function foodItemsQueryString(query: FoodItemsQuery): string {
  const params = new URLSearchParams();
  if (query.query !== undefined) params.set('query', query.query);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.savedOnly !== undefined) {
    params.set('savedOnly', String(query.savedOnly));
  }
  const value = params.toString();
  return value === '' ? '' : `?${value}`;
}

function foodLibraryQueryString(query: FoodLibraryQuery): string {
  const params = new URLSearchParams();
  params.set('section', query.section);
  if (query.query !== undefined) params.set('query', query.query);
  if (query.sort !== undefined) params.set('sort', query.sort);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  return `?${params.toString()}`;
}

function barcodeLookupQueryString(query: BarcodeLookupQuery): string {
  const params = new URLSearchParams();
  if (query.regionCode !== undefined) {
    params.set('regionCode', query.regionCode);
  }
  const value = params.toString();
  return value === '' ? '' : `?${value}`;
}

function dashboardQueryString(query: DailyNutrientTotalsQuery): string {
  const params = new URLSearchParams();
  if (query.date !== undefined) {
    params.set('date', query.date);
  }
  const value = params.toString();
  return value === '' ? '' : `?${value}`;
}

function weightLogsQueryString(query: WeightLogsQuery): string {
  const params = new URLSearchParams();
  if (query.date !== undefined) {
    params.set('startDate', query.date);
    params.set('endDate', query.date);
  }
  const value = params.toString();
  return value === '' ? '' : `?${value}`;
}

const recommendationList = (status?: RecommendationStatus) =>
  request<{ recommendations: Recommendation[] }>(
    `/recommendations${status === undefined ? '' : `?status=${status}`}`,
  ).then(({ recommendations }) => recommendations);

export const api = {
  analytics: {
    advanced: (query: AdvancedAnalyticsQuery = {}) =>
      request<AdvancedAnalytics>(`/analytics/advanced${queryString(query)}`),
    dailyNutrients: (query: DailyNutrientTotalsQuery = {}) =>
      request<DailyNutrientTotals>(
        `/analytics/nutrients/daily${dashboardQueryString(query)}`,
      ),
  },
  dashboard: {
    summary: () => request<DashboardSummary>('/dashboard/summary'),
  },
  foodItems: {
    library: (query: FoodLibraryQuery) =>
      request<FoodLibraryResponse>(
        `/food-items/library${foodLibraryQueryString(query)}`,
      ),
    libraryDetail: (id: string) =>
      request<FoodItem>(`/food-items/library/${id}`),
    list: (query: FoodItemsQuery = {}) =>
      request<{ foodItems: FoodItem[] }>(
        `/food-items${foodItemsQueryString(query)}`,
      ).then(({ foodItems }) => foodItems),
    searchCandidates: (input: FoodItemSearchCandidatesInput) =>
      request<{ candidates: AiFoodParseCandidate[] }>(
        '/food-items/search-candidates',
        {
          method: 'POST',
          body: input,
        },
      ).then(({ candidates }) => candidates),
    persistExternalCandidate: (input: FoodItemExternalCandidateInput) =>
      request<FoodItem>('/food-items/from-external-candidate', {
        method: 'POST',
        body: input,
      }),
    getById: (id: string) => request<FoodItem>(`/food-items/${id}`),
    create: (input: FoodItemInput) =>
      request<FoodItem>('/food-items', { method: 'POST', body: input }),
    createManual: (input: ManualFoodItemCreateInput) =>
      request<FoodItem>('/food-items/manual', { method: 'POST', body: input }),
    updateManual: (id: string, input: ManualFoodItemUpdateInput) =>
      request<FoodItem>(`/food-items/${id}/manual`, {
        method: 'PUT',
        body: input,
      }),
    update: (id: string, input: FoodItemInput) =>
      request<FoodItem>(`/food-items/${id}`, { method: 'PUT', body: input }),
    archive: (id: string) =>
      request<{ id: string; archived: true }>(`/food-items/${id}`, {
        method: 'DELETE',
      }),
    save: (id: string) =>
      request<{ id: string; saved: true }>(`/food-items/${id}/save`, {
        method: 'POST',
      }),
    unsave: (id: string) =>
      request<{ id: string; saved: false }>(`/food-items/${id}/save`, {
        method: 'DELETE',
      }),
    setDefaultServing: (id: string, input: FoodItemDefaultServingInput) =>
      request<{
        foodItemId: string;
        defaultServing: FoodItem['defaultServing'];
      }>(`/food-items/${id}/default-serving`, { method: 'PUT', body: input }),
    removeDefaultServing: (id: string) =>
      request<{ foodItemId: string; defaultServing: null }>(
        `/food-items/${id}/default-serving`,
        { method: 'DELETE' },
      ),
    restore: (id: string) =>
      request<FoodItem>(`/food-items/${id}/restore`, { method: 'POST' }),
    lookupBarcode: (barcode: string, query: BarcodeLookupQuery = {}) =>
      request<FoodItem>(
        `/food-items/barcode/${encodeURIComponent(barcode)}${barcodeLookupQueryString(query)}`,
      ),
    lookupBarcodeWithExternal: (input: FoodBarcodeLookupInput) =>
      request<FoodItem>('/food-items/barcode/lookup', {
        method: 'POST',
        body: input,
      }),
  },
  foodLogs: {
    saveAsManualFood: (id: string, input: FoodLogSaveAsManualFoodInput = {}) =>
      request<FoodItem>(`/food-logs/${id}/save-as-manual-food`, {
        method: 'POST',
        body: input,
      }),
    list: (query: FoodLogsQuery = {}) =>
      request<{ foodLogs: FoodLog[] }>(
        `/food-logs${foodLogsQueryString(query)}`,
      ).then(({ foodLogs }) => foodLogs),
    getById: (id: string) => request<FoodLog>(`/food-logs/${id}`),
    create: (input: FoodLogInput) =>
      request<FoodLog>('/food-logs', { method: 'POST', body: input }),
    createFromFoodItem: (input: FoodLogFromFoodItemInput) =>
      request<FoodLog>('/food-logs/from-food-item', {
        method: 'POST',
        body: input,
      }),
    createFromFoodItems: (input: FoodLogsFromFoodItemsInput) =>
      request<{ foodLogs: FoodLog[] }>('/food-logs/from-food-items', {
        method: 'POST',
        body: input,
      }).then(({ foodLogs }) => foodLogs),
    createFromCandidates: (input: FoodLogsFromCandidatesInput) =>
      request<{ foodLogs: FoodLog[] }>('/food-logs/from-candidates', {
        method: 'POST',
        body: input,
      }).then(({ foodLogs }) => foodLogs),
    createFromAiEstimate: (input: FoodLogFromAiEstimateInput) =>
      request<FoodLog>('/food-logs/from-ai-estimate', {
        method: 'POST',
        body: input,
      }),
    previewMixedMeal: (input: MixedMealPreviewInput) =>
      request<MixedMealPreviewResult>('/food-logs/mixed-meals/preview', {
        method: 'POST',
        body: input,
      }),
    createMixedMeal: (input: MixedMealCreateInput) =>
      request<FoodLog>('/food-logs/mixed-meals', {
        method: 'POST',
        body: input,
      }),
    update: (id: string, input: FoodLogUpdateInput) =>
      request<FoodLog>(`/food-logs/${id}`, { method: 'PUT', body: input }),
    delete: (id: string) =>
      request<{ id: string; deleted: true }>(`/food-logs/${id}`, {
        method: 'DELETE',
      }),
  },
  recipes: {
    list: () =>
      request<{ recipes: Recipe[] }>('/recipes').then(({ recipes }) => recipes),
    getById: (id: string) => request<Recipe>(`/recipes/${id}`),
    create: (input: RecipeCreateInput) =>
      request<Recipe>('/recipes', { method: 'POST', body: input }),
    update: (id: string, input: RecipeUpdateInput) =>
      request<Recipe>(`/recipes/${id}`, { method: 'PUT', body: input }),
    archive: (id: string) =>
      request<{ id: string; archived: true }>(`/recipes/${id}`, {
        method: 'DELETE',
      }),
    log: (id: string, input: RecipeLogInput) =>
      request<FoodLog>(`/recipes/${id}/log`, { method: 'POST', body: input }),
    addIngredient: (id: string, input: RecipeIngredientInput) =>
      request<Recipe>(`/recipes/${id}/ingredients`, {
        method: 'POST',
        body: input,
      }),
    updateIngredient: (
      id: string,
      ingredientId: string,
      input: RecipeIngredientInput,
    ) =>
      request<Recipe>(`/recipes/${id}/ingredients/${ingredientId}`, {
        method: 'PUT',
        body: input,
      }),
    deleteIngredient: (id: string, ingredientId: string) =>
      request<Recipe>(`/recipes/${id}/ingredients/${ingredientId}`, {
        method: 'DELETE',
      }),
  },
  weightLogs: {
    list: (query: WeightLogsQuery = {}) =>
      request<{ weightLogs: WeightLog[] }>(
        `/weight-logs${weightLogsQueryString(query)}`,
      ).then(({ weightLogs }) => weightLogs),
    getById: (id: string) => request<WeightLog>(`/weight-logs/${id}`),
    create: (input: WeightLogInput) =>
      request<WeightLog>('/weight-logs', { method: 'POST', body: input }),
    update: (id: string, input: WeightLogInput) =>
      request<WeightLog>(`/weight-logs/${id}`, {
        method: 'PUT',
        body: input,
      }),
    delete: (id: string) =>
      request<{ id: string; deleted: true }>(`/weight-logs/${id}`, {
        method: 'DELETE',
      }),
  },
  recommendations: {
    list: recommendationList,
    generate: () =>
      request<{ recommendations: Recommendation[] }>(
        '/recommendations/generate',
        { method: 'POST' },
      ).then(({ recommendations }) => recommendations),
    dismiss: (id: string) =>
      request<Recommendation>(`/recommendations/${id}/dismiss`, {
        method: 'PATCH',
      }),
  },
  profile: {
    get: () => request<Profile>('/profile', {}, profileSchema),
    update: (profile: Profile) =>
      request<Profile>(
        '/profile',
        { method: 'PUT', body: profile },
        profileSchema,
      ),
  },
  goals: {
    get: () => request<Goals>('/goals', {}, goalsSchema),
    update: (goals: Goals) =>
      request<Goals>('/goals', { method: 'PUT', body: goals }, goalsSchema),
  },
  trackingPreferences: {
    get: () =>
      request<TrackingPreferences>(
        '/tracking-preferences',
        {},
        trackingPreferencesSchema,
      ),
    update: (preferences: TrackingPreferences) =>
      request<TrackingPreferences>(
        '/tracking-preferences',
        {
          method: 'PUT',
          body: preferences,
        },
        trackingPreferencesSchema,
      ),
  },
  setup: {
    status: () => request<SetupStatus>('/setup/status', {}, setupStatusSchema),
    preview: (input: SetupInput) =>
      request<SetupPreviewResult>(
        '/setup/preview',
        { method: 'POST', body: input },
        setupPreviewResultSchema,
      ),
    update: (input: SetupInput) =>
      request<SetupResult>(
        '/setup',
        { method: 'PUT', body: input },
        setupResultSchema,
      ),
  },
  ai: {
    parseFood: (description: string) =>
      request<AiFoodParseResult>('/ai/food-parse', {
        method: 'POST',
        body: { description },
      }),
    estimateNutrition: (input: AiNutritionEstimateInput) =>
      request<AiNutritionEstimateResult>('/ai/nutrition-estimate', {
        method: 'POST',
        body: input,
      }),
    analyzePhoto: async (
      photo: PhotoAnalysisUpload,
      signal: AbortSignal,
    ): Promise<PhotoAnalysisResult> =>
      requestRaw<PhotoAnalysisResult>(
        '/ai/photo-analysis',
        await readLocalPhoto(photo, signal),
        signal,
        photoAnalysisResultSchema as unknown as ResponseSchema<PhotoAnalysisResult>,
      ),
  },
};

interface ValidationIssue {
  message?: unknown;
  path?: unknown;
}

const validationMessages: Record<string, string> = {
  name: 'Name is required.',
  age: 'Age must be a whole number of 0 or higher.',
  birthDate: 'Birthday must use YYYY-MM-DD.',
  sex: 'Choose male or female so calorie targets can be calculated.',
  heightInches: 'Height must be a whole number greater than 0.',
  startingWeightLb: 'Starting weight must be greater than 0.',
  activityLevel: 'Choose a valid activity level.',
  trainingStyle: 'Choose a valid training style.',
  foodName: 'Enter a food name.',
  description: 'Describe the meal you want to log.',
  mealType: 'Choose a valid meal type.',
  calories: 'Calories must be a whole number of 0 or higher.',
  protein: 'Protein must be 0 or higher.',
  carbs: 'Carbs must be 0 or higher.',
  fat: 'Fat must be 0 or higher.',
  weightLb: 'Weight must be greater than 0.',
  loggedAt: 'Choose a valid date and time.',
  timezone: 'Enter a valid timezone, such as America/Toronto.',
  goalPace: 'Choose a goal pace that matches your goal direction.',
  targetWeightLb: 'Target weight must be greater than 0.',
  targetCalories: 'Calorie target must be a whole number of 0 or higher.',
  targetProteinGrams: 'Protein target must be 0 or higher.',
};

function validationMessage(details: Record<string, unknown>): string | null {
  const issues = details.issues;
  if (!Array.isArray(issues)) {
    return null;
  }

  const firstIssue = issues[0] as ValidationIssue | undefined;
  const path = Array.isArray(firstIssue?.path)
    ? firstIssue.path.find((part): part is string => typeof part === 'string')
    : undefined;

  if (path !== undefined && validationMessages[path] !== undefined) {
    return validationMessages[path];
  }

  return typeof firstIssue?.message === 'string' ? firstIssue.message : null;
}

export function errorMessage(
  error: unknown,
  fallback = 'The request could not be completed. Please try again.',
): string {
  if (error instanceof ApiClientError) {
    if (error.code === 'VALIDATION_ERROR') {
      return (
        validationMessage(error.details) ??
        (error.message === 'Request validation failed'
          ? 'Please check the highlighted values and try again.'
          : error.message)
      );
    }
    if (error.code === 'INVALID_RESPONSE') {
      return `${error.message} Confirm the API URL is ${API_URL}.`;
    }
    if (error.code === 'INTERNAL_SERVER_ERROR') {
      return 'The server could not complete this request. Please try again.';
    }
    return error.message;
  }

  if (error instanceof TypeError) {
    return apiConnectionMessage();
  }

  return fallback;
}
