import { describe, expect, it } from 'vitest';
import { createExpoAnalyticsCacheStorage } from './analytics-cache-file-system';

describe('Expo analytics cache storage', () => {
  it('creates its document directory and uses the filesystem staging move contract', async () => {
    const calls: string[] = [];
    const storage = createExpoAnalyticsCacheStorage({
      documentDirectory: 'file:///documents/',
      makeDirectory: async (path) => {
        calls.push(`mkdir:${path}`);
      },
      read: async (path) => {
        calls.push(`read:${path}`);
        return 'cached';
      },
      write: async (path, value) => {
        calls.push(`write:${path}:${value}`);
      },
      move: async ({ from, to }) => {
        calls.push(`move:${from}:${to}`);
      },
      remove: async (path) => {
        calls.push(`remove:${path}`);
      },
    });

    await expect(
      storage.read('file:///documents/analytics/user.json'),
    ).resolves.toBe('cached');
    await storage.write('file:///documents/analytics/user.json.staged', 'next');
    await storage.move(
      'file:///documents/analytics/user.json.staged',
      'file:///documents/analytics/user.json',
    );

    expect(calls).toEqual([
      'mkdir:file:///documents/analytics/',
      'read:file:///documents/analytics/user.json',
      'write:file:///documents/analytics/user.json.staged:next',
      'move:file:///documents/analytics/user.json.staged:file:///documents/analytics/user.json',
    ]);
  });
});
