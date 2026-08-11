import type { AnalyticsCacheStorage } from './analytics-cache';

export function createExpoAnalyticsCacheStorage(input: {
  documentDirectory: string;
  makeDirectory(
    path: string,
    options: { intermediates: boolean },
  ): Promise<void>;
  read(path: string): Promise<string>;
  write(path: string, value: string): Promise<void>;
  remove(path: string, options: { idempotent: boolean }): Promise<void>;
}): AnalyticsCacheStorage {
  const analyticsDirectory = `${input.documentDirectory}analytics/`;
  const directoryReady = new Map<string, Promise<void>>();
  const ensureDirectory = (path: string) => {
    const slashIndex = path.lastIndexOf('/');
    const directory =
      slashIndex >= 0 ? path.slice(0, slashIndex + 1) : analyticsDirectory;
    const ready = directoryReady.get(directory);
    if (ready !== undefined) return ready;
    const creation = input
      .makeDirectory(directory, { intermediates: true })
      .catch((error: unknown) => {
        directoryReady.delete(directory);
        throw error;
      });
    directoryReady.set(directory, creation);
    return creation;
  };
  return {
    async read(path) {
      await ensureDirectory(path);
      try {
        return await input.read(path);
      } catch {
        return null;
      }
    },
    async write(path, value) {
      await ensureDirectory(path);
      await input.write(path, value);
    },
    // SDK 56 legacy iOS moveAsync removes `to` before moving `from`. Read the
    // staged payload and use the platform's atomic string write for replacement
    // so a failed final write leaves the previous committed file untouched.
    async replace(from, to) {
      await Promise.all([ensureDirectory(from), ensureDirectory(to)]);
      const value = await input.read(from);
      await input.write(to, value);
      try {
        await input.remove(from, { idempotent: true });
      } catch {
        // The committed destination is already valid; the fixed staged path
        // can be overwritten by the next write or removed during purge.
      }
    },
    async remove(path) {
      await ensureDirectory(path);
      await input.remove(path, { idempotent: true });
    },
  };
}
