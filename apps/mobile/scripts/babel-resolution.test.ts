import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mobileRequire = createRequire(
  fileURLToPath(new URL('../package.json', import.meta.url)),
);

describe('Release Babel dependency resolution', () => {
  it('resolves NativeWind’s JSX transform plugin from the mobile workspace', () => {
    const nativewindConfig = mobileRequire('nativewind/babel')() as {
      plugins?: unknown[];
    };
    const pluginNames = (nativewindConfig.plugins ?? [])
      .map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin))
      .filter((plugin): plugin is string => typeof plugin === 'string');

    expect(pluginNames).toContain('@babel/plugin-transform-react-jsx');
    const result = spawnSync(
      process.execPath,
      ['-e', "require.resolve('@babel/plugin-transform-react-jsx')"],
      {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        env: { ...process.env, NODE_PATH: undefined },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    expect(result.status).toBe(0);
  });
});
