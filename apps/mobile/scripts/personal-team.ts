import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export interface PersonalTeamCommand {
  command: string;
  args: string[];
  cwd: string;
}

export function createPersonalTeamEnvironment(
  parent: Readonly<Record<string, string | undefined>> = process.env,
): NodeJS.ProcessEnv {
  return {
    ...parent,
    IOS_REMOTE_PUSH_ENABLED: 'false',
  } as unknown as NodeJS.ProcessEnv;
}

export function buildPersonalTeamCommands(
  mobileDirectory: string,
): PersonalTeamCommand[] {
  const cwd = resolve(mobileDirectory);
  return [
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
      cwd,
    },
    {
      command: 'corepack',
      args: ['pnpm', 'exec', 'expo', 'run:ios', '--device'],
      cwd,
    },
  ];
}

function runCommand(
  command: PersonalTeamCommand,
  environment: NodeJS.ProcessEnv,
): void {
  const result = spawnSync(command.command, command.args, {
    cwd: command.cwd,
    env: environment,
    stdio: 'inherit',
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed at ${command.command}.`);
  }
}

export function runPersonalTeamWorkflow(): number {
  if (!process.version.startsWith('v22.')) {
    throw new Error('Node 22.x is required for the Personal Team workflow.');
  }
  const environment = createPersonalTeamEnvironment();
  const mobileDirectory = resolve(
    fileURLToPath(new URL('..', import.meta.url)),
  );
  for (const command of buildPersonalTeamCommands(mobileDirectory)) {
    runCommand(command, environment);
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runPersonalTeamWorkflow();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'unknown workflow failure';
    console.error(`Personal Team iOS UAT workflow failed: ${message}`);
    process.exitCode = 1;
  }
}
