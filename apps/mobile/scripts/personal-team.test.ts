import { describe, expect, it } from 'vitest';
import {
  buildPersonalTeamCommands,
  createPersonalTeamEnvironment,
} from './personal-team';

describe('Personal Team iOS UAT workflow', () => {
  it('forces remote push off without changing the caller environment', () => {
    const parent = {
      APP_ENV: 'development',
      EXPO_PUBLIC_API_URL: 'http://192.168.1.20:3000/api/v1',
      IOS_REMOTE_PUSH_ENABLED: 'true',
    };
    const environment = createPersonalTeamEnvironment(parent);

    expect(environment.IOS_REMOTE_PUSH_ENABLED).toBe('false');
    expect(parent.IOS_REMOTE_PUSH_ENABLED).toBe('true');
  });

  it('syncs config without clean prebuild, then runs on a connected device', () => {
    expect(buildPersonalTeamCommands('/repo/apps/mobile')).toEqual([
      {
        command: 'corepack',
        args: [
          'pnpm',
          'exec',
          'expo',
          'prebuild',
          '--platform',
          'ios',
          '--no-install',
        ],
        cwd: '/repo/apps/mobile',
      },
      {
        command: 'corepack',
        args: ['pnpm', 'exec', 'expo', 'run:ios', '--device'],
        cwd: '/repo/apps/mobile',
      },
    ]);
  });
});
