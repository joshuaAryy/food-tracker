export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: { route: '/insights'; recommendationId?: string };
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

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok)
    throw new Error(`Expo request failed with HTTP ${response.status}`);
  return (await response.json()) as T;
}

export async function sendExpoPushNotifications(
  messages: readonly ExpoPushMessage[],
): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return [];
  const result = await postJson<{ data: ExpoPushTicket[] }>(EXPO_URL, messages);
  return result.data;
}

export async function getExpoPushReceipts(
  ids: readonly string[],
): Promise<Record<string, ExpoPushReceipt>> {
  if (ids.length === 0) return {};
  const result = await postJson<{ data: Record<string, ExpoPushReceipt> }>(
    RECEIPT_URL,
    { ids },
  );
  return result.data;
}
