import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  loadStagingReleaseEnvFile,
  validateStagingReleaseEnvFileVariables,
  validateStagingReleaseEnvironment,
  type EnvironmentMap,
  type StagingReleaseConfig,
} from './staging-release-config';
import { resolveWorkflowPaths } from './staging-release-workflow';

export interface StagingSimulatorEnvironment {
  config: StagingReleaseConfig;
  environment: NodeJS.ProcessEnv;
}

export function createStagingSimulatorEnvironment(
  fileEnvironment: EnvironmentMap,
  parentEnvironment: NodeJS.ProcessEnv = process.env,
): StagingSimulatorEnvironment {
  validateStagingReleaseEnvFileVariables(fileEnvironment);
  const environment = {
    ...parentEnvironment,
    ...fileEnvironment,
    EXPO_NO_DOTENV: '1',
  } as NodeJS.ProcessEnv;

  delete environment.EXPO_NO_CLIENT_ENV_VARS;
  delete environment.SKIP_BUNDLING;

  const config = validateStagingReleaseEnvironment(environment, {
    requireRailwayHost: true,
  });
  return { config, environment };
}

export function runStagingSimulator(): number {
  if (!process.version.startsWith('v22.')) {
    throw new Error(
      'Node 22.x is required for the staging Simulator workflow.',
    );
  }

  const paths = resolveWorkflowPaths();
  const fileEnvironment = loadStagingReleaseEnvFile(paths.envFilePath);
  const { config, environment } =
    createStagingSimulatorEnvironment(fileEnvironment);

  if (!existsSync(paths.workspacePath)) {
    throw new Error(
      'The generated iOS workspace is missing. Prepare the staging iOS workspace before starting the Simulator workflow.',
    );
  }

  console.log(
    `Staging Simulator configuration validated for ${config.appEnvironment}. Starting LAN Metro.`,
  );
  const result = spawnSync(
    'corepack',
    ['pnpm', 'exec', 'expo', 'start', '--dev-client', '--lan'],
    {
      cwd: paths.mobileDirectory,
      env: environment,
      stdio: 'inherit',
    },
  );

  if (result.error !== undefined) throw result.error;
  return result.status ?? 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runStagingSimulator();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'unknown workflow failure';
    console.error(`Staging Simulator workflow failed: ${message}`);
    process.exitCode = 1;
  }
}
