import { withPodfile, type ConfigPlugin } from 'expo/config-plugins';
import { IOS_DEPLOYMENT_TARGET } from '../src/lib/app-metadata';

const NORMALIZATION_MARKER = '# Food Tracker deployment target normalization';

function findPostInstallEnd(lines: string[]): number {
  const start = lines.findIndex((line) =>
    /^\s*post_install\s+do\s+\|installer\|\s*$/.test(line),
  );
  if (start < 0) return -1;

  let depth = 1;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const opens =
      (line.match(/\bdo\b/g) ?? []).length +
      (/^\s*(?:if|unless|case|begin|def|class|module)\b/.test(line) ? 1 : 0);
    const closes = (line.match(/\bend\b/g) ?? []).length;
    depth += opens - closes;
    if (depth === 0) return index;
  }
  return -1;
}

export function ensurePodfileDeploymentTargetPostInstall(
  contents: string,
  deploymentTarget = IOS_DEPLOYMENT_TARGET,
): string {
  if (!/^\d+\.\d+$/.test(deploymentTarget)) {
    throw new Error('The iOS deployment target must be numeric.');
  }
  if (contents.includes(NORMALIZATION_MARKER)) return contents;

  const lines = contents.split(/\r?\n/);
  const postInstallEnd = findPostInstallEnd(lines);
  if (postInstallEnd < 0) {
    throw new Error('Generated Podfile is missing a post_install hook.');
  }

  lines.splice(
    postInstallEnd,
    0,
    NORMALIZATION_MARKER,
    '    installer.pods_project.targets.each do |target|',
    '      target.build_configurations.each do |config|',
    `        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'`,
    '      end',
    '    end',
  );
  return lines.join('\n');
}

const withIosDeploymentTarget: ConfigPlugin = (config) =>
  withPodfile(config, (config) => {
    const deploymentTarget =
      config.ios?.deploymentTarget ?? IOS_DEPLOYMENT_TARGET;
    config.modResults.contents = ensurePodfileDeploymentTargetPostInstall(
      config.modResults.contents,
      deploymentTarget,
    );
    return config;
  });

export default withIosDeploymentTarget;
