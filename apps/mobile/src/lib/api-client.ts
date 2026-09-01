import type {
  AdvancedAnalytics,
  AccountDeletionResponse,
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
  GoalsInput,
  Profile,
  ProfileUpdate,
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
  TrackingPreferencesResponse,
  WeightLog,
  WeightLogInput,
  WaterLog,
  WaterLogInput,
  WaterLogsQuery,
  PhotoAnalysisResult,
  PhotoAnalysisConfirmationInput,
  PhotoAnalysisConfirmationResponse,
  ProgressResponse,
  ReportsResponse,
  StreakCalendarResponse,
  CanonicalTrendResponse,
  TrendQueryInput,
  AnalyticsPreferenceUpdateInput,
  AnalyticsPreferenceValue,
  AnalyticsSavedView,
  AnalyticsSavedViewCreateInput,
  AnalyticsSavedViewOrderInput,
  AnalyticsSavedViewUpdateInput,
  AnalyticsMetricDefinition,
  AnalyticsContributorsResponse,
  CanonicalInsightsResponseWithOverview,
} from '@food-tracker/shared';
import {
  goalsSchema,
  profileSchema,
  setupPreviewResultSchema,
  setupResultSchema,
  setupStatusSchema,
  trackingPreferencesResponseSchema,
  photoAnalysisResultSchema,
  photoAnalysisConfirmationResponseSchema,
  canonicalTrendResponseSchema,
  canonicalInsightsResponseWithOverviewSchema,
} from '@food-tracker/shared';
import { File } from 'expo-file-system';
import Constants from 'expo-constants';
import {
  photoAnalysisRequestInit,
  readNormalizedPhotoBytes,
  PhotoUploadError,
} from './photo-image-core';
import type { NormalizedPhotoImage } from './photo-image-core';
import {
  parseApiResponse as parseStandardApiResponse,
  sanitizePublicErrorDetails,
  type ResponseParseDiagnostic,
  type ResponseSchema,
} from './api-response';
import { reportDiagnostic } from './safe-diagnostics';
import { resolveApiRuntimeConfig } from './api-target';
import { toUserFacingError } from './user-facing-errors';
import type { ApiAuthSession } from './api-auth-session';
import { adaptCanonicalInsightsResponseWithOverview } from './analytics/analytics-v1-adapter';

const runtimeExtra = Constants.expoConfig?.extra;
const resolvedApiRuntime = resolveApiRuntimeConfig(
  runtimeExtra ?? {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    appEnvironment: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  },
);
reportDiagnostic('api_target_resolved', {
  operation: resolvedApiRuntime.category,
});

export const API_URL = resolvedApiRuntime.apiUrl;

let apiAuthSession: ApiAuthSession | null = null;

export function configureApiAuthSession(session: ApiAuthSession | null): void {
  apiAuthSession = session;
}

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

function authErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

async function clearAuthSession(): Promise<void> {
  try {
    await apiAuthSession?.clearSession();
  } catch {
    // The signed-out state is already authoritative locally.
  }
}

async function tokenForRequest(
  forceRefresh: boolean,
): Promise<string | undefined> {
  if (apiAuthSession === null) return undefined;
  try {
    return await apiAuthSession.getIdToken(forceRefresh);
  } catch (error) {
    if (authErrorCode(error) === 'networkUnavailable') {
      throw new ApiClientError(apiConnectionMessage(), 'NETWORK_ERROR', 0);
    }
    await clearAuthSession();
    throw new ApiClientError(
      'Your session has expired. Please sign in again.',
      'AUTH_TOKEN_EXPIRED',
      401,
    );
  }
}

function withAuthorization(
  init: RequestInit,
  token: string | undefined,
): RequestInit {
  const headers = new Headers(init.headers);
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

async function fetchWithAuth(
  url: string,
  createRequestInit: (token: string | undefined) => RequestInit,
): Promise<Response> {
  let token = await tokenForRequest(false);
  let didRefresh = false;

  while (true) {
    let response: Response;
    try {
      response = await fetch(url, createRequestInit(token));
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        throw new ApiClientError(
          'The request timed out before the save result was confirmed.',
          'NETWORK_TIMEOUT',
          0,
        );
      }
      throw new ApiClientError(apiConnectionMessage(), 'NETWORK_ERROR', 0);
    }

    if (response.status !== 401 || apiAuthSession === null || didRefresh) {
      return response;
    }

    didRefresh = true;
    try {
      token = await tokenForRequest(true);
    } catch {
      throw new ApiClientError(
        'Your session has expired. Please sign in again.',
        'AUTH_TOKEN_EXPIRED',
        401,
      );
    }
  }
}

export async function parseApiResponse<T>(
  response: Response,
  schema?: ResponseSchema<T>,
  onStage?: ResponseParseDiagnostic,
): Promise<T> {
  return parseStandardApiResponse(
    response,
    schema,
    (event, details) => reportDiagnostic(event, details),
    ({ response: errorResponse, error }) =>
      new ApiClientError(
        'The request could not be completed.',
        error.code as string,
        errorResponse.status,
        sanitizePublicErrorDetails(error.details as Record<string, unknown>),
      ),
    onStage,
  );
}

function apiConnectionMessage(): string {
  return 'We couldn’t connect. Check your connection and try again.';
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

  const response = await fetchWithAuth(`${API_URL}${path}`, (token) =>
    withAuthorization(requestInit, token),
  );

  return parseApiResponse(response, schema);
}

async function requestRaw<T>(
  path: string,
  body: ArrayBuffer,
  signal: AbortSignal,
  schema: ResponseSchema<T>,
): Promise<T> {
  reportDiagnostic('photo_request_prepared', {
    operation: 'photo_analysis',
    bodyByteSize: body.byteLength,
  });
  reportDiagnostic('photo_request_started', { operation: 'photo_analysis' });
  let response: Response;
  try {
    response = await fetchWithAuth(`${API_URL}${path}`, (token) =>
      withAuthorization(
        photoAnalysisRequestInit({ bytes: body, signal }),
        token,
      ),
    );
  } catch (error) {
    reportDiagnostic('photo_request_failed', {
      operation: 'photo_analysis',
      errorCategory: signal.aborted ? 'aborted' : 'network_or_body',
    });
    if (signal.aborted) {
      throw new ApiClientError('Photo analysis was cancelled.', 'CANCELLED', 0);
    }
    throw error;
  }
  return parseApiResponse(response, schema);
}

export const PHOTO_ANALYSIS_CLIENT_TIMEOUT_MS = 17_000;
export const PHOTO_CONFIRMATION_CLIENT_TIMEOUT_MS = 20_000;

export type PhotoAnalysisUpload = Pick<
  NormalizedPhotoImage,
  'uri' | 'mimeType' | 'byteSize'
>;

async function readLocalPhoto(
  photo: PhotoAnalysisUpload,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  reportDiagnostic('photo_read_started', {
    operation: 'photo_analysis',
    uriScheme: photo.uri.split(':', 1)[0] ?? 'unknown',
  });
  try {
    const prepared = await readNormalizedPhotoBytes({
      ...photo,
      signal,
      openFile: (uri) => new File(uri),
    });
    reportDiagnostic('photo_read_completed', { operation: 'photo_analysis' });
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

export interface ReportingQuery {
  date?: string;
}

export interface ReportsQuery extends ReportingQuery {
  period: 'week' | 'month';
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

function reportingQueryString(query: ReportingQuery): string {
  const params = new URLSearchParams();
  if (query.date !== undefined) params.set('date', query.date);
  const value = params.toString();
  return value === '' ? '' : `?${value}`;
}

function reportsQueryString(query: ReportsQuery): string {
  const params = new URLSearchParams({ period: query.period });
  if (query.date !== undefined) params.set('date', query.date);
  return `?${params.toString()}`;
}

function streakCalendarQueryString(month: string): string {
  const params = new URLSearchParams({ month });
  return `?${params.toString()}`;
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

function waterLogsQueryString(query: WaterLogsQuery): string {
  const params = new URLSearchParams();
  if (query.date !== undefined) params.set('date', query.date);
  if (query.startDate !== undefined) params.set('startDate', query.startDate);
  if (query.endDate !== undefined) params.set('endDate', query.endDate);
  const value = params.toString();
  return value === '' ? '' : `?${value}`;
}

const recommendationList = (status?: RecommendationStatus) =>
  request<{ recommendations: Recommendation[] }>(
    `/recommendations${status === undefined ? '' : `?status=${status}`}`,
  ).then(({ recommendations }) => recommendations);

const nutritionTargets = () =>
  request<{ targets: Array<Record<string, unknown>> }>('/nutrition-targets');

export const api = {
  account: {
    delete: () =>
      request<AccountDeletionResponse>('/account', { method: 'DELETE' }),
  },
  analytics: {
    advanced: (query: AdvancedAnalyticsQuery = {}) =>
      request<AdvancedAnalytics>(`/analytics/advanced${queryString(query)}`),
    dailyNutrients: (query: DailyNutrientTotalsQuery = {}) =>
      request<DailyNutrientTotals>(
        `/analytics/nutrients/daily${dashboardQueryString(query)}`,
      ),
    progress: (query: ReportingQuery = {}) =>
      request<ProgressResponse>(
        `/analytics/progress${reportingQueryString(query)}`,
      ),
    reports: (query: ReportsQuery) =>
      request<ReportsResponse>(
        `/analytics/reports${reportsQueryString(query)}`,
      ),
    trend: (input: TrendQueryInput) =>
      request<CanonicalTrendResponse>(
        '/analytics/trends/query',
        {
          method: 'POST',
          body: input,
        },
        canonicalTrendResponseSchema as unknown as ResponseSchema<CanonicalTrendResponse>,
      ),
    trendCatalog: () =>
      request<{
        mode: 'simple' | 'complex';
        metrics: AnalyticsMetricDefinition[];
      }>('/analytics/trends/catalog'),
    contributors: (input: TrendQueryInput, includeAll = false) =>
      request<AnalyticsContributorsResponse>('/analytics/trends/contributors', {
        method: 'POST',
        body: { ...input, ...(includeAll ? { includeAll: true } : {}) },
      }),
    insights: (period: 'week' | 'month') =>
      request<CanonicalInsightsResponseWithOverview>(
        `/analytics/insights?period=${period}`,
        {},
        canonicalInsightsResponseWithOverviewSchema as unknown as ResponseSchema<CanonicalInsightsResponseWithOverview>,
      ).then((response) => {
        const adapted = adaptCanonicalInsightsResponseWithOverview(
          response,
          new Date().toISOString(),
        );
        if (adapted === null) {
          throw new ApiClientError(
            'Analytics response could not be read.',
            'INVALID_RESPONSE',
            200,
          );
        }
        return adapted;
      }),
    preferences: () =>
      request<{ preferences: AnalyticsPreferenceValue }>(
        '/analytics/preferences',
      ).then(({ preferences }) => preferences),
    updatePreferences: (input: AnalyticsPreferenceUpdateInput) =>
      request<{ preferences: AnalyticsPreferenceValue }>(
        '/analytics/preferences',
        {
          method: 'PUT',
          body: input,
        },
      ).then(({ preferences }) => preferences),
    savedViews: () =>
      request<{ savedViews: AnalyticsSavedView[] }>(
        '/analytics/saved-views',
      ).then(({ savedViews }) => savedViews),
    createSavedView: (input: AnalyticsSavedViewCreateInput) =>
      request<{ savedView: AnalyticsSavedView }>('/analytics/saved-views', {
        method: 'POST',
        body: input,
      }).then(({ savedView }) => savedView),
    updateSavedView: (id: string, input: AnalyticsSavedViewUpdateInput) =>
      request<{ savedView: AnalyticsSavedView }>(
        `/analytics/saved-views/${id}`,
        {
          method: 'PATCH',
          body: input,
        },
      ).then(({ savedView }) => savedView),
    duplicateSavedView: (id: string) =>
      request<{ savedView: AnalyticsSavedView }>(
        `/analytics/saved-views/${id}/duplicate`,
        { method: 'POST' },
      ).then(({ savedView }) => savedView),
    reorderSavedViews: (input: AnalyticsSavedViewOrderInput) =>
      request<{ savedViews: AnalyticsSavedView[] }>(
        '/analytics/saved-views/order',
        {
          method: 'PUT',
          body: input,
        },
      ).then(({ savedViews }) => savedViews),
    deleteSavedView: (id: string) =>
      request<{ id: string; deleted: boolean }>(
        `/analytics/saved-views/${id}`,
        {
          method: 'DELETE',
        },
      ),
    streakCalendar: (month: string) =>
      request<StreakCalendarResponse>(
        `/analytics/streak-calendar${streakCalendarQueryString(month)}`,
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
    confirmPhotoAnalysisEntries: (
      input: PhotoAnalysisConfirmationInput,
      signal?: AbortSignal,
    ) =>
      request<PhotoAnalysisConfirmationResponse>(
        '/food-logs/from-photo-analysis',
        {
          method: 'POST',
          body: input,
          ...(signal === undefined ? {} : { signal }),
        },
        photoAnalysisConfirmationResponseSchema,
      ),
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
  waterLogs: {
    list: (query: WaterLogsQuery = {}) =>
      request<{ waterLogs: WaterLog[] }>(
        `/water-logs${waterLogsQueryString(query)}`,
      ).then(({ waterLogs }) => waterLogs),
    getById: (id: string) => request<WaterLog>(`/water-logs/${id}`),
    create: (input: WaterLogInput) =>
      request<WaterLog>('/water-logs', { method: 'POST', body: input }),
    update: (id: string, input: WaterLogInput) =>
      request<WaterLog>(`/water-logs/${id}`, {
        method: 'PUT',
        body: input,
      }),
    delete: (id: string) =>
      request<{ id: string; deleted: true }>(`/water-logs/${id}`, {
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
  nutritionTargets: {
    list: nutritionTargets,
    set: (nutrientKey: string, value: number) =>
      request<{ targets: Array<Record<string, unknown>> }>(
        `/nutrition-targets/${encodeURIComponent(nutrientKey)}`,
        { method: 'PUT', body: { value } },
      ),
    useRecommended: (nutrientKey: string) =>
      request<{ targets: Array<Record<string, unknown>> }>(
        `/nutrition-targets/${encodeURIComponent(nutrientKey)}`,
        { method: 'DELETE' },
      ),
  },
  notifications: {
    preferences: {
      get: () =>
        request<{
          recommendationInsightsEnabled: boolean;
          loggingRemindersEnabled: boolean;
        }>('/notifications/preferences'),
      update: (input: {
        recommendationInsightsEnabled: boolean;
        loggingRemindersEnabled: boolean;
      }) =>
        request<{
          recommendationInsightsEnabled: boolean;
          loggingRemindersEnabled: boolean;
        }>('/notifications/preferences', { method: 'PUT', body: input }),
    },
    installations: {
      register: (
        installationId: string,
        expoPushToken: string,
        platform: 'ios' | 'android',
      ) =>
        request<{ installationId: string; enabled: boolean }>(
          `/notifications/installations/${encodeURIComponent(installationId)}`,
          { method: 'PUT', body: { expoPushToken, platform, enabled: true } },
        ),
      detach: (installationId: string) =>
        request<{ detached: true }>(
          `/notifications/installations/${encodeURIComponent(installationId)}`,
          { method: 'DELETE' },
        ),
    },
  },
  profile: {
    get: () => request<Profile>('/profile', {}, profileSchema),
    update: (profile: ProfileUpdate) =>
      request<Profile>(
        '/profile',
        { method: 'PUT', body: profile },
        profileSchema,
      ),
  },
  goals: {
    get: () => request<Goals>('/goals', {}, goalsSchema),
    update: (goals: GoalsInput) =>
      request<Goals>('/goals', { method: 'PUT', body: goals }, goalsSchema),
  },
  trackingPreferences: {
    get: () =>
      request<TrackingPreferencesResponse>(
        '/tracking-preferences',
        {},
        trackingPreferencesResponseSchema,
      ),
    update: (preferences: TrackingPreferences) =>
      request<TrackingPreferencesResponse>(
        '/tracking-preferences',
        {
          method: 'PUT',
          body: preferences,
        },
        trackingPreferencesResponseSchema,
      ),
  },
  setup: {
    status: () => request<SetupStatus>('/setup/status', {}, setupStatusSchema),
    preview: (input: SetupInput & { currentWeightLb?: number | null }) =>
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

export function errorMessage(
  error: unknown,
  fallback = 'The request could not be completed. Please try again.',
): string {
  return toUserFacingError(error, fallback);
}
