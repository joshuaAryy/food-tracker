import { describe, expect, it } from 'vitest';
import {
  ensureReleaseBundleCannotBeSkipped,
  type XcodeProjectLike,
} from '../config-plugins/with-release-bundle-safety';

function projectWithBundleScript(script: string): XcodeProjectLike {
  return {
    hash: {
      project: {
        objects: {
          PBXNativeTarget: {
            target: {
              isa: 'PBXNativeTarget',
              name: '"FoodTracker"',
              productType: '"com.apple.product-type.application"',
              buildPhases: [{ value: 'phase' }],
            },
          },
          PBXShellScriptBuildPhase: {
            phase: {
              isa: 'PBXShellScriptBuildPhase',
              name: '"Bundle React Native code and images"',
              shellScript: `"${script
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\' + '"')
                .replace(/\n/g, '\\n')}"`,
            },
          },
        },
      },
    },
  };
}

const expoBundleScript = [
  'if [[ "$CONFIGURATION" = *Debug* ]]; then',
  '  export SKIP_BUNDLING=1',
  'fi',
  'export BUNDLE_COMMAND="export:embed"',
  'react-native-xcode.sh',
].join('\n');

describe('Release bundle safety config plugin', () => {
  it('adds a Release-only inherited-skip reset while preserving Debug Metro behavior', () => {
    const project = projectWithBundleScript(expoBundleScript);

    ensureReleaseBundleCannotBeSkipped(project);

    const phase = project.hash.project.objects.PBXShellScriptBuildPhase?.phase;
    const encodedScript =
      typeof phase === 'object' && phase !== null
        ? phase.shellScript
        : undefined;
    const script = encodedScript
      ?.replace(/^"|"$/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"');
    expect(script).toContain('unset SKIP_BUNDLING');
    expect(script).toContain('$CONFIGURATION" != *Debug*');
    expect(script).toContain('export SKIP_BUNDLING=1');
  });

  it('does not duplicate the Release reset when prebuild runs repeatedly', () => {
    const project = projectWithBundleScript(expoBundleScript);

    ensureReleaseBundleCannotBeSkipped(project);
    ensureReleaseBundleCannotBeSkipped(project);

    const phase = project.hash.project.objects.PBXShellScriptBuildPhase?.phase;
    const encodedScript =
      typeof phase === 'object' && phase !== null
        ? phase.shellScript
        : undefined;
    expect(encodedScript?.match(/unset SKIP_BUNDLING/g)).toHaveLength(1);
  });

  it('rejects a generated project without the FoodTracker bundle phase', () => {
    const project: XcodeProjectLike = {
      hash: {
        project: {
          objects: {
            PBXNativeTarget: {
              target: {
                isa: 'PBXNativeTarget',
                name: '"FoodTracker"',
                productType: '"com.apple.product-type.application"',
                buildPhases: [{ value: 'missing' }],
              },
            },
            PBXShellScriptBuildPhase: {},
          },
        },
      },
    };

    expect(() => ensureReleaseBundleCannotBeSkipped(project)).toThrow(
      'FoodTracker bundle phase',
    );
  });
});
