import * as FileSystem from 'expo-file-system/legacy';
import {
  createAnalyticsCache,
  type AnalyticsCache,
  type AnalyticsCacheStorage,
} from './analytics-cache';
import { createExpoAnalyticsCacheStorage } from './analytics-cache-file-system';

export function createNativeAnalyticsCacheStorage(): AnalyticsCacheStorage {
  if (FileSystem.documentDirectory === null) {
    throw new Error('Analytics cache storage is unavailable.');
  }
  return createExpoAnalyticsCacheStorage({
    documentDirectory: FileSystem.documentDirectory,
    makeDirectory: FileSystem.makeDirectoryAsync,
    read: FileSystem.readAsStringAsync,
    write: FileSystem.writeAsStringAsync,
    remove: FileSystem.deleteAsync,
  });
}

export function createNativeAnalyticsCache(
  staleAfterMs: number,
): AnalyticsCache {
  if (FileSystem.documentDirectory === null) {
    throw new Error('Analytics cache storage is unavailable.');
  }
  return createAnalyticsCache({
    storage: createNativeAnalyticsCacheStorage(),
    pathFor: (userId, key) =>
      `${FileSystem.documentDirectory}analytics/${encodeURIComponent(userId)}/${key}.json`,
    now: Date.now,
    staleAfterMs,
  });
}

export async function purgeNativeAnalyticsCache(userId: string): Promise<void> {
  if (FileSystem.documentDirectory === null) return;
  await FileSystem.deleteAsync(
    `${FileSystem.documentDirectory}analytics/${encodeURIComponent(userId)}`,
    { idempotent: true },
  );
}
