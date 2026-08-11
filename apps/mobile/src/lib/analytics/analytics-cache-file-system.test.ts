import { describe, expect, it } from 'vitest';
import { createExpoAnalyticsCacheStorage } from './analytics-cache-file-system';

function createFilesystem() {
  const calls: string[] = [];
  const directories = new Set(['file:///documents/']);
  const files = new Map<string, string>();
  const parentDirectory = (path: string) =>
    path.slice(0, path.lastIndexOf('/') + 1);

  return {
    calls,
    directories,
    files,
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
      files.set(path, value);
    },
    move: async ({ from, to }: { from: string; to: string }) => {
      calls.push(`move:${from}:${to}`);
      if (!directories.has(parentDirectory(to))) {
        throw new Error('Parent directory does not exist');
      }
      const value = files.get(from);
      if (value === undefined) throw new Error('Missing staged file');
      files.set(to, value);
      files.delete(from);
    },
    remove: async (path: string) => {
      calls.push(`remove:${path}`);
      files.delete(path);
    },
  };
}

describe('Expo analytics cache storage', () => {
  it('creates nested parents before the first staged write and keeps atomic order', async () => {
    const filesystem = createFilesystem();
    const storage = createExpoAnalyticsCacheStorage({
      documentDirectory: 'file:///documents/',
      makeDirectory: filesystem.makeDirectory,
      read: filesystem.read,
      write: filesystem.write,
      move: filesystem.move,
      remove: filesystem.remove,
    });
    const stagedPath =
      'file:///documents/analytics/user%2Fspecial/insights-week.json.staged';
    const committedPath = stagedPath.replace('.staged', '');

    await storage.write(stagedPath, 'next');
    await storage.move(stagedPath, committedPath);

    expect(filesystem.directories).toContain(
      'file:///documents/analytics/user%2Fspecial/',
    );
    expect(filesystem.files.get(committedPath)).toBe('next');
    expect(filesystem.calls).toEqual([
      'mkdir:file:///documents/analytics/user%2Fspecial/',
      `write:${stagedPath}:next`,
      `move:${stagedPath}:${committedPath}`,
    ]);
  });

  it('creates each encoded user parent without decoding path separators', async () => {
    const filesystem = createFilesystem();
    const storage = createExpoAnalyticsCacheStorage({
      documentDirectory: 'file:///documents/',
      makeDirectory: filesystem.makeDirectory,
      read: filesystem.read,
      write: filesystem.write,
      move: filesystem.move,
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
});
