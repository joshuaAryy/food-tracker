export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: {
    route: '/insights' | '/food-log';
    recommendationId?: string;
  };
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPT_URL = 'https://exp.host/--/api/v2/push/getReceipts';
export const EXPO_REQUEST_TIMEOUT_MS = 10_000;

async function postJson<T>(
  url: string,
  payload: unknown,
  timeoutMs = EXPO_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(`Expo request failed with HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendExpoPushNotifications(
  messages: readonly ExpoPushMessage[],
  timeoutMs = EXPO_REQUEST_TIMEOUT_MS,
): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return [];
  const result = await postJson<{ data: ExpoPushTicket[] }>(
    EXPO_URL,
    messages,
    timeoutMs,
  );
  return result.data;
}

export async function getExpoPushReceipts(
  ids: readonly string[],
  timeoutMs = EXPO_REQUEST_TIMEOUT_MS,
): Promise<Record<string, ExpoPushReceipt>> {
  if (ids.length === 0) return {};
  const result = await postJson<{ data: Record<string, ExpoPushReceipt> }>(
    RECEIPT_URL,
    { ids },
    timeoutMs,
  );
  return result.data;
}
