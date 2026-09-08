import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Railway repository configuration', () => {
  it('loads the ignored API environment file for local development', () => {
    const packageConfiguration = JSON.parse(
      readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'),
    ) as { scripts?: { dev?: string } };

    expect(packageConfiguration.scripts?.dev).toBe(
      'tsx watch --env-file=.env src/server.ts',
    );
  });

  it('builds, migrates, starts, and health-checks the API from the workspace root', () => {
    const configuration = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../../railway.json'), 'utf8'),
    ) as {
      build?: { buildCommand?: string; watchPatterns?: string[] };
      deploy?: {
        preDeployCommand?: string | string[];
        startCommand?: string;
        healthcheckPath?: string;
        restartPolicyType?: string;
        restartPolicyMaxRetries?: number;
      };
    };

    expect(configuration.build?.buildCommand).toContain(
      'corepack pnpm prisma:generate',
    );
    expect(configuration.build?.buildCommand).toContain('corepack pnpm build');
    expect(configuration.build?.watchPatterns).toEqual(
      expect.arrayContaining(['apps/api/**', 'packages/shared/**']),
    );
    expect(configuration.deploy?.preDeployCommand).toBe(
      'corepack pnpm --filter @food-tracker/api migrate:deploy:ready',
    );
    expect(configuration.deploy?.startCommand).toBe(
      'corepack pnpm --filter @food-tracker/api start',
    );
    expect(configuration.deploy?.healthcheckPath).toBe('/health');
    expect(configuration.deploy?.restartPolicyType).toBe('ON_FAILURE');
    expect(configuration.deploy?.restartPolicyMaxRetries).toBeGreaterThan(0);
  });
});
