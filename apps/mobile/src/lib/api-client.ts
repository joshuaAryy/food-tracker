import type {
  ApiResponse,
  DashboardSummary,
  FoodLog,
  Goals,
  Profile,
  Recommendation,
  TrackingPreferences,
  WeightLog,
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
  const response = await fetch(`${API_URL}${path}`, requestInit);

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

export interface FoodLogInput {
  foodName: string;
  mealType: FoodLog['mealType'];
  calories: number;
  protein: number;
  loggedAt: string;
  carbs?: number | null;
  fat?: number | null;
  notes?: string | null;
}

export interface WeightLogInput {
  weightLb: number;
  loggedAt: string;
}

export const api = {
  dashboard: {
    summary: () => request<DashboardSummary>('/dashboard/summary'),
  },
  foodLogs: {
    list: () =>
      request<{ foodLogs: FoodLog[] }>('/food-logs').then(
        ({ foodLogs }) => foodLogs,
      ),
    create: (input: FoodLogInput) =>
      request<FoodLog>('/food-logs', { method: 'POST', body: input }),
  },
  weightLogs: {
    list: () =>
      request<{ weightLogs: WeightLog[] }>('/weight-logs').then(
        ({ weightLogs }) => weightLogs,
      ),
    create: (input: WeightLogInput) =>
      request<WeightLog>('/weight-logs', { method: 'POST', body: input }),
  },
  recommendations: {
    list: () =>
      request<{ recommendations: Recommendation[] }>('/recommendations').then(
        ({ recommendations }) => recommendations,
      ),
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
