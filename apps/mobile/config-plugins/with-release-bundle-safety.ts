import {
  withXcodeProject,
  type ConfigPlugin,
  type XcodeProject,
} from 'expo/config-plugins';

interface PbxBuildPhase {
  isa?: string;
  name?: string;
  shellScript?: string;
}

interface PbxTargetPhaseReference {
  value?: string;
}

interface PbxTarget {
  isa?: string;
  name?: string;
  productType?: string;
  buildPhases?: PbxTargetPhaseReference[];
}

export interface XcodeProjectLike {
  hash: {
    project: {
      objects: {
        PBXNativeTarget?: Record<string, PbxTarget | string>;
        PBXShellScriptBuildPhase?: Record<string, PbxBuildPhase | string>;
      };
    };
  };
}

const BUNDLE_PHASE_NAME = 'Bundle React Native code and images';
const RELEASE_RESET = [
  'if [[ "$CONFIGURATION" != *Debug* ]]; then',
  '  unset SKIP_BUNDLING',
  'fi',
].join('\n');

function unquote(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.replace(/^"|"$/g, '');
}

function decodePbxString(value: string): string {
  const unquoted = value.replace(/^"|"$/g, '');
  return unquoted
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function encodePbxString(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\\"')
    .replace(/\n/g, '\\n')}"`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Make the generated FoodTracker bundle phase immune to a stale shell-level
 * SKIP_BUNDLING value while retaining Expo's Debug/Metro behavior.
 */
export function ensureReleaseBundleCannotBeSkipped(
  project: XcodeProjectLike,
): XcodeProjectLike {
  const objects = project.hash.project.objects;
  const targets = objects.PBXNativeTarget ?? {};
  const foodTrackerTarget = Object.values(targets).find((candidate) => {
    if (!isObject(candidate)) return false;
    return (
      candidate.isa === 'PBXNativeTarget' &&
      unquote(
        typeof candidate.name === 'string' ? candidate.name : undefined,
      ) === 'FoodTracker' &&
      unquote(
        typeof candidate.productType === 'string'
          ? candidate.productType
          : undefined,
      ) === 'com.apple.product-type.application'
    );
  });
  if (!isObject(foodTrackerTarget)) {
    throw new Error('Generated FoodTracker bundle phase is missing.');
  }

  const targetPhaseIds = Array.isArray(foodTrackerTarget.buildPhases)
    ? foodTrackerTarget.buildPhases
        .map((phase) => phase?.value)
        .filter((value): value is string => typeof value === 'string')
    : [];
  const phases = objects.PBXShellScriptBuildPhase ?? {};
  const bundlePhase = targetPhaseIds
    .map((phaseId) => phases[phaseId])
    .find((candidate) => {
      if (!isObject(candidate)) return false;
      return (
        candidate.isa === 'PBXShellScriptBuildPhase' &&
        unquote(
          typeof candidate.name === 'string' ? candidate.name : undefined,
        ) === BUNDLE_PHASE_NAME
      );
    });
  if (!isObject(bundlePhase) || typeof bundlePhase.shellScript !== 'string') {
    throw new Error('Generated FoodTracker bundle phase is missing.');
  }

  const script = decodePbxString(bundlePhase.shellScript);
  if (script.includes(RELEASE_RESET)) return project;

  const debugSkipBlock =
    /if\s*\[\[\s*"\$CONFIGURATION"\s*=\s*\*Debug\*\s*\]\]\s*;\s*then\s*\n\s*export SKIP_BUNDLING=1\s*\n\s*fi/;
  if (!debugSkipBlock.test(script)) {
    throw new Error(
      'Generated FoodTracker bundle phase has no Debug-only skip boundary.',
    );
  }
  bundlePhase.shellScript = encodePbxString(
    script.replace(debugSkipBlock, (match) => `${match}\n${RELEASE_RESET}`),
  );
  return project;
}

const withReleaseBundleSafety: ConfigPlugin = (config) =>
  withXcodeProject(config, (config) => {
    config.modResults = ensureReleaseBundleCannotBeSkipped(
      config.modResults as unknown as XcodeProjectLike,
    ) as unknown as XcodeProject;
    return config;
  });

export default withReleaseBundleSafety;
