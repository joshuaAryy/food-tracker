import type {
  ApiResponse,
  AdvancedAnalytics,
  AiFoodParseCandidate,
  AiFoodParseResult,
  DashboardSummary,
  DailyNutrientTotals,
  FoodBarcodeLookupInput,
  FoodItem,
  FoodItemInput,
  FoodItemSearchCandidatesInput,
  FoodLog,
  FoodLogsFromCandidatesInput,
  FoodLogFromFoodItemInput,
  FoodLogsFromFoodItemsInput,
  FoodLogInput,
  Goals,
  Profile,
  Recommendation,
  RecommendationStatus,
  SetupInput,
  SetupPreviewResult,
  SetupResult,
  SetupStatus,
  TrackingPreferences,
  WeightLog,
  WeightLogInput,
} from '@food-tracker/shared';
import {
  API_BASE_PATH,
  goalsSchema,
  profileSchema,
  setupPreviewResultSchema,
  setupResultSchema,
  setupStatusSchema,
  trackingPreferencesSchema,
} from '@food-tracker/shared';
import { Platform } from 'react-native';

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

  if (schema === undefined) {
    return envelope.data as T;
  }

  const parsed = schema.safeParse(envelope.data);
  if (!parsed.success) {
    throw new ApiClientError(
      'The API returned data that does not match the expected contract.',
      'INVALID_RESPONSE',
      response.status,
    );
  }

  return parsed.data;
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
    getById: (id: string) => request<FoodItem>(`/food-items/${id}`),
    create: (input: FoodItemInput) =>
      request<FoodItem>('/food-items', { method: 'POST', body: input }),
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
    update: (id: string, input: FoodLogInput) =>
      request<FoodLog>(`/food-logs/${id}`, { method: 'PUT', body: input }),
    delete: (id: string) =>
      request<{ id: string; deleted: true }>(`/food-logs/${id}`, {
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
