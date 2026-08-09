import type { AnalyticsCacheStorage } from './analytics-cache';

export function createExpoAnalyticsCacheStorage(input: {
  documentDirectory: string;
  makeDirectory(path: string, options: { intermediates: boolean }): Promise<void>;
  read(path: string): Promise<string>;
  write(path: string, value: string): Promise<void>;
  move(input: { from: string; to: string }): Promise<void>;
  remove(path: string, options: { idempotent: boolean }): Promise<void>;
}): AnalyticsCacheStorage {
  const directory = `${input.documentDirectory}analytics/`;
  let directoryReady: Promise<void> | null = null;
  const ensureDirectory = () => {
    directoryReady ??= input.makeDirectory(directory, { intermediates: true });
    return directoryReady;
  };
  return {
    async read(path) {
      await ensureDirectory();
      try {
        return await input.read(path);
      } catch {
        return null;
      }
    },
    async write(path, value) {
      await ensureDirectory();
      await input.write(path, value);
    },
    async move(from, to) {
      await ensureDirectory();
      await input.move({ from, to });
    },
    async remove(path) {
      await ensureDirectory();
      await input.remove(path, { idempotent: true });
    },
  };
}
