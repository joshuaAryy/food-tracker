import * as FileSystem from 'expo-file-system/legacy';
import type { AnalyticsCacheStorage } from './analytics-cache';
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
    move: FileSystem.moveAsync,
    remove: FileSystem.deleteAsync,
  });
}
