import { describe, expect, it } from 'vitest';
import { createExpoAnalyticsCacheStorage } from './analytics-cache-file-system';

function createFilesystem() {
  const calls: string[] = [];
  const directories = new Set(['file:///documents/']);
  const files = new Map<string, string>();
  const failedWrites = new Set<string>();
  const parentDirectory = (path: string) =>
    path.slice(0, path.lastIndexOf('/') + 1);

  return {
    calls,
    directories,
    files,
    failedWrites,
    makeDirectory: async (path: string) => {
      calls.push(`mkdir:${path}`);
      directories.add(path);
    },
    read: async (path: string) => {
      calls.push(`read:${path}`);
      const value = files.get(path);
      if (value === undefined) throw new Error('Missing file');
      return value;
    },
    write: async (path: string, value: string) => {
      calls.push(`write:${path}:${value}`);
      if (!directories.has(parentDirectory(path))) {
        throw new Error('Parent directory does not exist');
      }
      if (failedWrites.has(path)) throw new Error('Atomic write failed');
      files.set(path, value);
    },
    remove: async (path: string) => {
      calls.push(`remove:${path}`);
      files.delete(path);
    },
  };
}

describe('Expo analytics cache storage', () => {
  it('creates nested parents before staged write and atomic replacement', async () => {
    const filesystem = createFilesystem();
    const storage = createExpoAnalyticsCacheStorage({
      documentDirectory: 'file:///documents/',
      makeDirectory: filesystem.makeDirectory,
      read: filesystem.read,
      write: filesystem.write,
      remove: filesystem.remove,
    });
    const stagedPath =
      'file:///documents/analytics/user%2Fspecial/insights-week.json.staged';
    const committedPath = stagedPath.replace('.staged', '');

    await storage.write(stagedPath, 'next');
    await storage.replace(stagedPath, committedPath);

    expect(filesystem.directories).toContain(
      'file:///documents/analytics/user%2Fspecial/',
    );
    expect(filesystem.files.get(committedPath)).toBe('next');
    expect(filesystem.files.has(stagedPath)).toBe(false);
    expect(filesystem.calls).toEqual([
      'mkdir:file:///documents/analytics/user%2Fspecial/',
      `write:${stagedPath}:next`,
      `read:${stagedPath}`,
      `write:${committedPath}:next`,
      `remove:${stagedPath}`,
    ]);
  });

  it('creates each encoded user parent without decoding path separators', async () => {
    const filesystem = createFilesystem();
    const storage = createExpoAnalyticsCacheStorage({
      documentDirectory: 'file:///documents/',
      makeDirectory: filesystem.makeDirectory,
      read: filesystem.read,
      write: filesystem.write,
      remove: filesystem.remove,
    });

    await storage.write(
      'file:///documents/analytics/user%2F..%2Fescape/insights.json.staged',
      'safe',
    );

    expect(filesystem.directories).toContain(
      'file:///documents/analytics/user%2F..%2Fescape/',
    );
    expect(filesystem.directories).not.toContain(
      'file:///documents/analytics/user/',
    );
  });

  it('preserves the existing destination when the atomic final write fails', async () => {
    const filesystem = createFilesystem();
    const storage = createExpoAnalyticsCacheStorage({
      documentDirectory: 'file:///documents/',
      makeDirectory: filesystem.makeDirectory,
      read: filesystem.read,
      write: filesystem.write,
      remove: filesystem.remove,
    });
    const stagedPath =
      'file:///documents/analytics/user/insights-week.json.staged';
    const committedPath = stagedPath.replace('.staged', '');

    await storage.write(committedPath, 'old');
    await storage.write(stagedPath, 'new');
    filesystem.failedWrites.add(committedPath);

    await expect(storage.replace(stagedPath, committedPath)).rejects.toThrow(
      'Atomic write failed',
    );
    expect(filesystem.files.get(committedPath)).toBe('old');
    expect(filesystem.files.get(stagedPath)).toBe('new');
  });
});
