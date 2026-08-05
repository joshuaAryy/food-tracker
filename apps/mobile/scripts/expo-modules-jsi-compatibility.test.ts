import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve('expo-modules-jsi/package.json');
const packageDirectory = dirname(packageJsonPath);
const mobilePackagePath = join(process.cwd(), 'package.json');
const workspaceManifestPath = join(process.cwd(), '../../pnpm-workspace.yaml');
const lockfilePath = join(process.cwd(), '../../pnpm-lock.yaml');
const runtimeSource = readFileSync(
  join(
    packageDirectory,
    'apple/Sources/ExpoModulesJSI/Runtime/JavaScriptRuntime.swift',
  ),
  'utf8',
);

describe('ExpoModulesJSI Xcode 27 compatibility', () => {
  it('does not form the optional C callback through a conditional expression', () => {
    expect(runtimeSource).not.toMatch(/set\s*==\s*nil\s*\?\s*nil\s*:\s*setter/);
    expect(runtimeSource).toContain('if set == nil');
    expect(runtimeSource).toContain('getter, nil, propertyNamesGetter');
    expect(runtimeSource).toContain('getter, setter, propertyNamesGetter');
  });

  it('keeps ExpoModulesJSI within SDK 56 and transitive', () => {
    const packageMetadata = JSON.parse(
      readFileSync(packageJsonPath, 'utf8'),
    ) as {
      name: string;
      version: string;
    };
    const appPackage = JSON.parse(readFileSync(mobilePackagePath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageMetadata.name).toBe('expo-modules-jsi');
    expect(packageMetadata.version).toMatch(/^56\./);
    expect(appPackage.dependencies?.['expo-modules-jsi']).toBeUndefined();
    expect(appPackage.devDependencies?.['expo-modules-jsi']).toBeUndefined();
  });

  it('records the patch in workspace and lockfile metadata for clean installs', () => {
    const workspaceManifest = readFileSync(workspaceManifestPath, 'utf8');
    const lockfile = readFileSync(lockfilePath, 'utf8');

    expect(workspaceManifest).toContain(
      'expo-modules-jsi@56.0.10: patches/expo-modules-jsi@56.0.10.patch',
    );
    expect(lockfile).toMatch(
      /expo-modules-jsi@56\.0\.10:\n\s+hash: [a-f0-9]+\n\s+path: patches\/expo-modules-jsi@56\.0\.10\.patch/,
    );
  });
});
