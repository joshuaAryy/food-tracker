import type {
  ApiResponse,
  AdvancedAnalytics,
  DashboardSummary,
  FoodLog,
  FoodLogInput,
  Goals,
  Profile,
  Recommendation,
  RecommendationStatus,
  TrackingPreferences,
  WeightLog,
  WeightLogInput,
} from '@food-tracker/shared';
import { API_BASE_PATH } from '@food-tracker/shared';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
export const API_URL =
  configuredApiUrl ?? `http://localhost:3000${API_BASE_PATH}`;

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

async function request<T>(
  path: string,
  options: RequestOptions = {},
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
    throw new ApiClientError(
      `Could not reach the API at ${API_URL}.`,
      'NETWORK_ERROR',
      0,
    );
  }

  let envelope: ApiResponse<T>;

  try {
    envelope = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      'The API returned an unreadable response.',
      'INVALID_RESPONSE',
      response.status,
    );
  }

  if (!response.ok || !envelope.success) {
    const error = envelope.success
      ? {
          code: 'HTTP_ERROR',
          message: `Request failed with status ${response.status}.`,
          details: {},
        }
      : envelope.error;

    throw new ApiClientError(
      error.message,
      error.code,
      response.status,
      error.details,
    );
  }

  return envelope.data;
}

export interface AdvancedAnalyticsQuery {
  date?: string;
  timezone?: string;
  rangeDays?: number;
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

const recommendationList = (status?: RecommendationStatus) =>
  request<{ recommendations: Recommendation[] }>(
    `/recommendations${status === undefined ? '' : `?status=${status}`}`,
  ).then(({ recommendations }) => recommendations);

export const api = {
  analytics: {
    advanced: (query: AdvancedAnalyticsQuery = {}) =>
      request<AdvancedAnalytics>(`/analytics/advanced${queryString(query)}`),
  },
  dashboard: {
    summary: () => request<DashboardSummary>('/dashboard/summary'),
  },
  foodLogs: {
    list: () =>
      request<{ foodLogs: FoodLog[] }>('/food-logs').then(
        ({ foodLogs }) => foodLogs,
      ),
    getById: (id: string) => request<FoodLog>(`/food-logs/${id}`),
    create: (input: FoodLogInput) =>
      request<FoodLog>('/food-logs', { method: 'POST', body: input }),
    update: (id: string, input: FoodLogInput) =>
      request<FoodLog>(`/food-logs/${id}`, { method: 'PUT', body: input }),
    delete: (id: string) =>
      request<{ id: string; deleted: true }>(`/food-logs/${id}`, {
        method: 'DELETE',
      }),
  },
  weightLogs: {
    list: () =>
      request<{ weightLogs: WeightLog[] }>('/weight-logs').then(
        ({ weightLogs }) => weightLogs,
      ),
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
    get: () => request<Profile>('/profile'),
    update: (profile: Profile) =>
      request<Profile>('/profile', { method: 'PUT', body: profile }),
  },
  goals: {
    get: () => request<Goals>('/goals'),
    update: (goals: Goals) =>
      request<Goals>('/goals', { method: 'PUT', body: goals }),
  },
  trackingPreferences: {
    get: () => request<TrackingPreferences>('/tracking-preferences'),
    update: (preferences: TrackingPreferences) =>
      request<TrackingPreferences>('/tracking-preferences', {
        method: 'PUT',
        body: preferences,
      }),
  },
};

interface ValidationIssue {
  message?: unknown;
  path?: unknown;
}

const validationMessages: Record<string, string> = {
  foodName: 'Enter a food name.',
  mealType: 'Choose a valid meal type.',
  calories: 'Calories must be a whole number of 0 or higher.',
  protein: 'Protein must be 0 or higher.',
  carbs: 'Carbs must be 0 or higher.',
  fat: 'Fat must be 0 or higher.',
  weightLb: 'Weight must be greater than 0.',
  loggedAt: 'Choose a valid date and time.',
  timezone: 'Enter a valid timezone, such as America/Toronto.',
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
      return `The server response could not be read. Confirm the API is running at ${API_URL}.`;
    }
    if (error.code === 'INTERNAL_SERVER_ERROR') {
      return 'The server could not complete this request. Please try again.';
    }
    return error.message;
  }

  if (error instanceof TypeError) {
    return `Could not reach the API at ${API_URL}.`;
  }

  return fallback;
}
