import type { ApiResponse } from '@food-tracker/shared';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code = 'REQUEST_FAILED',
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options?.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiClientError(
      'Unable to reach the API. Check that the backend is running.',
      'NETWORK_ERROR',
    );
  }

  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !body.success) {
    throw new ApiClientError(
      body.success ? 'The request could not be completed.' : body.error.message,
      body.success ? 'REQUEST_FAILED' : body.error.code,
    );
  }

  return body.data;
}
