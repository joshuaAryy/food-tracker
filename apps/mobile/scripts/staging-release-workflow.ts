import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_VERSION,
  IOS_BUILD_NUMBER,
  IOS_DEPLOYMENT_TARGET,
} from '../src/lib/app-metadata';
import {
  loadStagingReleaseEnvFile,
  createStagingReleaseXcodeEnvironment,
  validateStagingReleaseEnvFileVariables,
  validateFirebasePlist,
  validateStagingReleaseEnvironment,
  type StagingReleaseConfig,
} from './staging-release-config';

export const IOS_RELATIVE_DIRECTORY = 'apps/mobile/ios';
export const IOS_WORKSPACE_RELATIVE_PATH =
  'apps/mobile/ios/FoodTracker.xcworkspace';

const SCRIPT_DIRECTORY = fileURLToPath(new URL('.', import.meta.url));
export const MOBILE_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..');
export const REPOSITORY_ROOT = resolve(MOBILE_DIRECTORY, '../..');

export interface WorkflowPaths {
  rootDir: string;
  mobileDirectory: string;
  iosDirectory: string;
  workspacePath: string;
  envFilePath: string;
}

export function resolveWorkflowPaths(rootDir = REPOSITORY_ROOT): WorkflowPaths {
  const resolvedRootDir = resolve(rootDir);
  const mobileDirectory = join(resolvedRootDir, 'apps/mobile');
  const iosDirectory = join(mobileDirectory, 'ios');
  return {
    rootDir: resolvedRootDir,
    mobileDirectory,
    iosDirectory,
    workspacePath: join(iosDirectory, 'FoodTracker.xcworkspace'),
    envFilePath: join(mobileDirectory, '.env.staging-release.local'),
  };
}

const EXPECTED_IOS_TOP_LEVEL_ENTRIES = new Set([
  '.gitignore',
  '.xcode.env',
  '.xcode.env.local',
  'FoodTracker',
  'FoodTracker.xcodeproj',
  'FoodTracker.xcworkspace',
  'Podfile',
  'Podfile.lock',
  'Podfile.properties.json',
  'PrivacyInfo.xcprivacy',
  'Gemfile',
  'Gemfile.lock',
  '.ruby-version',
  'Pods',
  'build',
]);

export interface WorkflowCommand {
  command: string;
  args: string[];
  cwd: string;
}

export interface WorkflowDependencies {
  runCommand?: (
    command: string,
    args: string[],
    cwd: string,
    environment: NodeJS.ProcessEnv,
  ) => void;
  captureCommand?: (
    command: string,
    args: string[],
    cwd: string,
    environment?: NodeJS.ProcessEnv,
  ) => string;
  readStatus?: (rootDir: string) => string;
  isIgnored?: (path: string, rootDir: string) => boolean;
  isTracked?: (path: string, rootDir: string) => boolean;
  removeDirectory?: (path: string) => void;
}

export interface PreparationOptions extends WorkflowDependencies {
  rootDir?: string;
  envFilePath?: string;
  skipToolchainChecks?: boolean;
  skipDeviceCheck?: boolean;
}

export function hasConnectedPhysicalIPhone(output: string): boolean {
  try {
    const records: unknown = JSON.parse(output);
    if (Array.isArray(records)) {
      return records.some((record) => {
        if (typeof record !== 'object' || record === null) return false;
        const candidate = record as Record<string, unknown>;
        return (
          candidate.simulator === false &&
          candidate.available === true &&
          candidate.ignored !== true &&
          typeof candidate.name === 'string' &&
          /iphone/i.test(candidate.name) &&
          typeof candidate.platform === 'string' &&
          candidate.platform.includes('iphoneos')
        );
      });
    }
  } catch {
    // Older Xcode versions may emit one human-readable device per line.
  }
  return output.split(/\r?\n/).some((line) => {
    const normalized = line.toLowerCase();
    return (
      normalized.includes('iphone') &&
      normalized.includes('connected') &&
      !normalized.includes('simulator') &&
      !normalized.includes('shutdown') &&
      !normalized.includes('unavailable')
    );
  });
}

function defaultCaptureCommand(
  command: string,
  args: string[],
  cwd: string,
  environment?: NodeJS.ProcessEnv,
): string {
  try {
    return execFileSync(command, args, {
      cwd,
      env: environment,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    void error;
    throw new Error(`Command failed at ${command}.`);
  }
}

function defaultRunCommand(
  command: string,
  args: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
): void {
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`Command failed at ${command}.`);
  }
}

function defaultReadStatus(rootDir: string): string {
  return defaultCaptureCommand(
    'git',
    ['status', '--porcelain=v1', '-z'],
    rootDir,
  );
}

function defaultIsIgnored(path: string, rootDir: string): boolean {
  const result = spawnSync('git', ['check-ignore', '-q', '--', path], {
    cwd: rootDir,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function defaultIsTracked(path: string, rootDir: string): boolean {
  const result = spawnSync('git', ['ls-files', '--error-unmatch', '--', path], {
    cwd: rootDir,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function defaultRemoveDirectory(path: string): void {
  rmSync(path, { recursive: true, force: false });
}

function assertRequiredBranch(
  rootDir: string,
  capture: WorkflowDependencies['captureCommand'],
): void {
  const branch = (capture ?? defaultCaptureCommand)(
    'git',
    ['branch', '--show-current'],
    rootDir,
  ).trim();
  if (branch !== 'phase-17-free-xcode-standalone' && branch !== 'main') {
    throw new Error(
      'The staging Release workflow requires phase-17-free-xcode-standalone or post-merge main.',
    );
  }
}

function assertNoStagedFiles(
  rootDir: string,
  capture: WorkflowDependencies['captureCommand'],
): void {
  const staged = (capture ?? defaultCaptureCommand)(
    'git',
    ['diff', '--cached', '--name-only'],
    rootDir,
  ).trim();
  if (staged !== '') {
    throw new Error('The staging Release workflow requires zero staged files.');
  }
}

export function assertSafeGeneratedIosDirectory(
  iosDirectory: string,
  rootDir: string,
  dependencies: Pick<WorkflowDependencies, 'isIgnored' | 'isTracked'> = {},
): void {
  if (!existsSync(iosDirectory)) return;
  const stat = lstatSync(iosDirectory);
  if (stat.isSymbolicLink()) {
    throw new Error('Generated iOS state must not be a symlink.');
  }
  if (!stat.isDirectory()) {
    throw new Error('Generated iOS state must be a directory.');
  }
  const ignored =
    dependencies.isIgnored?.(IOS_RELATIVE_DIRECTORY, rootDir) ??
    defaultIsIgnored(IOS_RELATIVE_DIRECTORY, rootDir);
  if (!ignored) {
    throw new Error('Generated iOS state is not ignored by Git.');
  }
  const tracked =
    dependencies.isTracked?.(IOS_RELATIVE_DIRECTORY, rootDir) ??
    defaultIsTracked(IOS_RELATIVE_DIRECTORY, rootDir);
  if (tracked) {
    throw new Error(
      'Generated iOS state is tracked; refusing to overwrite or remove it.',
    );
  }
}

function assertNoSymlinkedNativeChildren(iosDirectory: string): void {
  for (const entry of readdirSync(iosDirectory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Generated iOS state contains an unexpected symlink (${entry.name}).`,
      );
    }
    if (!EXPECTED_IOS_TOP_LEVEL_ENTRIES.has(entry.name)) {
      throw new Error(
        `Generated iOS state contains an unexpected top-level entry (${entry.name}).`,
      );
    }
  }
}

export function writeStagingReleaseXcodeEnvironmentFile(
  iosDirectory: string,
  rootDir: string,
  config: StagingReleaseConfig,
  dependencies: Pick<WorkflowDependencies, 'isIgnored' | 'isTracked'> = {},
  nodeBinary = process.execPath,
): string {
  const handoffPath = join(iosDirectory, '.xcode.env.local');
  const relativePath = join(IOS_RELATIVE_DIRECTORY, '.xcode.env.local');
  if (!existsSync(iosDirectory)) {
    throw new Error('Generated iOS state is missing before Xcode handoff.');
  }
  const iosStat = lstatSync(iosDirectory);
  if (!iosStat.isDirectory() || iosStat.isSymbolicLink()) {
    throw new Error('Generated iOS state must be a regular directory.');
  }
  if (
    !(
      dependencies.isIgnored?.(relativePath, rootDir) ??
      defaultIsIgnored(relativePath, rootDir)
    )
  ) {
    throw new Error(
      'Generated Xcode environment handoff is not ignored by Git.',
    );
  }
  if (
    dependencies.isTracked?.(relativePath, rootDir) ??
    defaultIsTracked(relativePath, rootDir)
  ) {
    throw new Error(
      'Generated Xcode environment handoff is tracked; refusing to overwrite it.',
    );
  }
  if (existsSync(handoffPath)) {
    const stat = lstatSync(handoffPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(
        'Generated Xcode environment handoff must be a regular file.',
      );
    }
  }
  const contents = createStagingReleaseXcodeEnvironment(config, nodeBinary);
  writeFileSync(handoffPath, contents, { encoding: 'utf8', mode: 0o600 });
  if (readFileSync(handoffPath, 'utf8') !== contents) {
    throw new Error(
      'Generated Xcode environment handoff could not be verified.',
    );
  }
  return handoffPath;
}

interface TargetBuildSettings {
  name: 'Debug' | 'Release';
  marketingVersion: string | undefined;
  currentProjectVersion: string | undefined;
  deploymentTarget: string | undefined;
  bundleIdentifier: string | undefined;
  infoPlistFile: string | undefined;
}

function readXcodeSetting(
  buildSettings: string,
  key: string,
): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(
    `^\\s*${escapedKey}\\s*=\\s*"?([^";\\n]+)"?;`,
    'm',
  ).exec(buildSettings);
  return match?.[1]?.trim();
}

function readTargetBuildSettings(projectText: string): TargetBuildSettings[] {
  const configurations: TargetBuildSettings[] = [];
  const configurationPattern =
    /(?:^|\n)\s*[0-9A-F]+ \/\* (Debug|Release) \*\/ = \{\s*isa = XCBuildConfiguration;[\s\S]*?buildSettings = \{([\s\S]*?)\s*\};\s*name = (Debug|Release);\s*\};/g;
  for (const match of projectText.matchAll(configurationPattern)) {
    const name = match[1];
    const settings = match[2];
    const trailingName = match[3];
    if (
      (name !== 'Debug' && name !== 'Release') ||
      name !== trailingName ||
      settings === undefined
    ) {
      continue;
    }
    const infoPlistFile = readXcodeSetting(settings, 'INFOPLIST_FILE');
    const bundleIdentifier = readXcodeSetting(
      settings,
      'PRODUCT_BUNDLE_IDENTIFIER',
    );
    if (infoPlistFile !== 'FoodTracker/Info.plist') continue;
    configurations.push({
      name,
      infoPlistFile,
      bundleIdentifier,
      deploymentTarget: readXcodeSetting(
        settings,
        'IPHONEOS_DEPLOYMENT_TARGET',
      ),
      marketingVersion: readXcodeSetting(settings, 'MARKETING_VERSION'),
      currentProjectVersion: readXcodeSetting(
        settings,
        'CURRENT_PROJECT_VERSION',
      ),
    });
  }
  return configurations;
}

function assertGeneratedDeploymentTargets(
  iosDirectory: string,
  projectText: string,
): void {
  const targets = readTargetBuildSettings(projectText);
  const appTargets = targets.filter(
    (target) => target.infoPlistFile === 'FoodTracker/Info.plist',
  );
  if (
    appTargets.length !== 2 ||
    appTargets.some(
      (target) => target.deploymentTarget !== IOS_DEPLOYMENT_TARGET,
    )
  ) {
    throw new Error(
      'Generated FoodTracker application deployment target is not canonical.',
    );
  }

  const podsProjectPath = join(
    iosDirectory,
    'Pods',
    'Pods.xcodeproj',
    'project.pbxproj',
  );
  if (!existsSync(podsProjectPath)) {
    throw new Error(
      'Generated CocoaPods project is missing deployment targets.',
    );
  }
  const podsProjectText = readFileSync(podsProjectPath, 'utf8');
  const values = [
    ...podsProjectText.matchAll(
      /IPHONEOS_DEPLOYMENT_TARGET\s*=\s*"?([^";\n]+)"?;/g,
    ),
  ].map((match) => match[1]?.trim());
  if (
    values.length === 0 ||
    values.some(
      (value) =>
        value === undefined ||
        !/^\d+(?:\.\d+)?$/.test(value) ||
        Number(value) < Number(IOS_DEPLOYMENT_TARGET),
    )
  ) {
    throw new Error(
      'Generated CocoaPods target deployment target is below the canonical minimum.',
    );
  }
}

function readPlistString(contents: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<key>${escapedKey}<\\/key>\\s*<string>([^<]*)<\\/string>`)
    .exec(contents)?.[1]
    ?.trim();
}

function resolvePlistMetadataValue(
  value: string | undefined,
  target: TargetBuildSettings,
  settingName: 'MARKETING_VERSION' | 'CURRENT_PROJECT_VERSION',
): string | undefined {
  if (value === undefined) return undefined;
  if (value === `$(${settingName})`) {
    return settingName === 'MARKETING_VERSION'
      ? target.marketingVersion
      : target.currentProjectVersion;
  }
  return value;
}

function assertGeneratedReleaseMetadata(
  projectText: string,
  infoText: string,
  expectedBundleIdentifier: string,
): void {
  const targets = readTargetBuildSettings(projectText);
  const targetsByName = new Map(targets.map((target) => [target.name, target]));
  const debug = targetsByName.get('Debug');
  const release = targetsByName.get('Release');
  if (debug === undefined || release === undefined || targets.length !== 2) {
    throw new Error(
      'Generated iOS Release state is missing deterministic Debug and Release target settings.',
    );
  }
  for (const target of [debug, release]) {
    if (
      target.bundleIdentifier !== expectedBundleIdentifier ||
      target.currentProjectVersion !== IOS_BUILD_NUMBER
    ) {
      throw new Error(
        'Generated Release version/build metadata is not deterministic.',
      );
    }
  }

  const rawVersion = readPlistString(infoText, 'CFBundleShortVersionString');
  const rawBuildNumber = readPlistString(infoText, 'CFBundleVersion');
  if (rawVersion === undefined || rawBuildNumber === undefined) {
    throw new Error(
      'Generated Release version/build metadata is not deterministic.',
    );
  }
  for (const target of [debug, release]) {
    const version = resolvePlistMetadataValue(
      rawVersion,
      target,
      'MARKETING_VERSION',
    );
    const buildNumber = resolvePlistMetadataValue(
      rawBuildNumber,
      target,
      'CURRENT_PROJECT_VERSION',
    );
    if (version !== APP_VERSION || buildNumber !== IOS_BUILD_NUMBER) {
      throw new Error(
        'Generated Release version/build metadata is not deterministic.',
      );
    }
  }
}

export function assertGeneratedSceneLifecycle(
  iosDirectory: string,
  projectText: string,
  infoText: string,
): void {
  const requiredInfoPlistEntries = [
    '<key>UIApplicationSceneManifest</key>',
    '<key>UIApplicationSupportsMultipleScenes</key>',
    '<false/>',
    '<key>UISceneConfigurations</key>',
    '<key>UIWindowSceneSessionRoleApplication</key>',
    '<key>UISceneConfigurationName</key>',
    '<string>Default Configuration</string>',
    '<key>UISceneDelegateClassName</key>',
    '<string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>',
  ];
  if (requiredInfoPlistEntries.some((entry) => !infoText.includes(entry))) {
    throw new Error(
      'Generated iOS scene lifecycle configuration is incomplete.',
    );
  }

  const appDelegatePath = join(
    iosDirectory,
    'FoodTracker',
    'AppDelegate.swift',
  );
  const sceneDelegatePath = join(
    iosDirectory,
    'FoodTracker',
    'SceneDelegate.swift',
  );
  let appDelegateText: string;
  let sceneDelegateText: string;
  try {
    const appDelegateStat = lstatSync(appDelegatePath);
    const sceneDelegateStat = lstatSync(sceneDelegatePath);
    if (
      !appDelegateStat.isFile() ||
      appDelegateStat.isSymbolicLink() ||
      !sceneDelegateStat.isFile() ||
      sceneDelegateStat.isSymbolicLink()
    ) {
      throw new Error();
    }
    appDelegateText = readFileSync(appDelegatePath, 'utf8');
    sceneDelegateText = readFileSync(sceneDelegatePath, 'utf8');
  } catch {
    throw new Error('Generated iOS scene lifecycle source is incomplete.');
  }
  if (
    !/configurationForConnecting\s+connectingSceneSession/.test(
      appDelegateText,
    ) ||
    !appDelegateText.includes('UISceneConfiguration') ||
    appDelegateText.includes('factory.startReactNative(') ||
    appDelegateText.includes('window = UIWindow(frame: UIScreen.main.bounds)')
  ) {
    throw new Error(
      'Generated AppDelegate does not adopt the iOS scene lifecycle.',
    );
  }
  if (
    !/final class SceneDelegate\s*:\s*UIResponder,\s*UIWindowSceneDelegate/.test(
      sceneDelegateText,
    ) ||
    (sceneDelegateText.match(/startReactNative\(/g) ?? []).length !== 1 ||
    !sceneDelegateText.includes('UIWindow(windowScene: windowScene)') ||
    !sceneDelegateText.includes('openURLContexts') ||
    !sceneDelegateText.includes('continue userActivity') ||
    !sceneDelegateText.includes('application(UIApplication.shared, open: url')
  ) {
    throw new Error(
      'Generated SceneDelegate does not own app startup and URL routing.',
    );
  }

  const foodTrackerTarget = readPbxSectionBlocks(
    projectText,
    'PBXNativeTarget',
  ).find(
    (target) =>
      target.isa === 'PBXNativeTarget' &&
      readPbxValue(target.body, 'name') === 'FoodTracker' &&
      readPbxValue(target.body, 'productType') ===
        'com.apple.product-type.application',
  );
  const targetBuildPhases = foodTrackerTarget
    ? /buildPhases\s*=\s*\(([\s\S]*?)\);/.exec(foodTrackerTarget.body)?.[1]
    : undefined;
  const phaseIds =
    targetBuildPhases === undefined
      ? []
      : [...targetBuildPhases.matchAll(/^\s*([0-9A-F]+)\s+\/\*/gm)].map(
          (match) => match[1],
        );
  const sourcePhase = readPbxSectionBlocks(
    projectText,
    'PBXSourcesBuildPhase',
  ).find(
    (phase) =>
      phaseIds.includes(phase.id) &&
      phase.body.includes('SceneDelegate.swift in Sources'),
  );
  if (
    sourcePhase === undefined ||
    !/\/\* SceneDelegate\.swift \*\/ = \{\s*isa = PBXFileReference;[\s\S]*?path = FoodTracker\/SceneDelegate\.swift;/.test(
      projectText,
    ) ||
    !/\/\* SceneDelegate\.swift in Sources \*\/ = \{\s*isa = PBXBuildFile;/.test(
      projectText,
    )
  ) {
    throw new Error(
      'Generated FoodTracker target does not include SceneDelegate.swift.',
    );
  }
}

interface PbxSectionBlock {
  id: string;
  name: string;
  isa: string;
  body: string;
}

function readPbxSectionBlocks(
  projectText: string,
  sectionName: string,
): PbxSectionBlock[] {
  const section = new RegExp(
    `/\\* Begin ${sectionName} section \\*/([\\s\\S]*?)/\\* End ${sectionName} section \\*/`,
  ).exec(projectText)?.[1];
  if (section === undefined) return [];
  const blockPattern =
    /^\s*([0-9A-F]+)\s+\/\*\s+([^*]+?)\s+\*\/\s*=\s*\{\s*\n?\s*isa\s*=\s*([^;]+);([\s\S]*?)^\s*\};/gm;
  return [...section.matchAll(blockPattern)].map((match) => ({
    id: match[1] ?? '',
    name: match[2]?.trim() ?? '',
    isa: match[3]?.trim() ?? '',
    body: match[4] ?? '',
  }));
}

function readPbxValue(body: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(
    `^\\s*${escapedKey}\\s*=\\s*(?:"((?:\\\\.|[^"])*)"|([^;\\n]+));`,
    'm',
  ).exec(body);
  return match?.[1] ?? match?.[2]?.trim();
}

function decodePbxShellScript(value: string): string {
  return value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
}

function assertGeneratedReleaseBundleConfiguration(projectText: string): void {
  const targets = readPbxSectionBlocks(projectText, 'PBXNativeTarget');
  const foodTrackerTarget = targets.find(
    (target) =>
      target.isa === 'PBXNativeTarget' &&
      readPbxValue(target.body, 'name') === 'FoodTracker' &&
      readPbxValue(target.body, 'productType') ===
        'com.apple.product-type.application',
  );
  const targetBuildPhases = foodTrackerTarget
    ? /buildPhases\s*=\s*\(([\s\S]*?)\);/.exec(foodTrackerTarget.body)?.[1]
    : undefined;
  if (targetBuildPhases === undefined) {
    throw new Error(
      'Generated Release target is missing the React Native bundle build phase.',
    );
  }
  const phaseIds = [
    ...targetBuildPhases.matchAll(/^\s*([0-9A-F]+)\s+\/\*/gm),
  ].map((match) => match[1]);
  const shellPhases = readPbxSectionBlocks(
    projectText,
    'PBXShellScriptBuildPhase',
  );
  const bundlePhases = shellPhases.filter(
    (phase) =>
      phaseIds.includes(phase.id) &&
      phase.name === 'Bundle React Native code and images',
  );
  if (bundlePhases.length !== 1) {
    throw new Error(
      'Generated Release target is missing the React Native bundle build phase.',
    );
  }
  const bundlePhase = bundlePhases[0];
  if (bundlePhase === undefined) {
    throw new Error(
      'Generated Release target is missing the React Native bundle build phase.',
    );
  }
  if (
    readPbxValue(bundlePhase.body, 'buildActionMask') !== '2147483647' ||
    readPbxValue(bundlePhase.body, 'runOnlyForDeploymentPostprocessing') !==
      '0' ||
    readPbxValue(bundlePhase.body, 'shellPath') !== '/bin/sh'
  ) {
    throw new Error('Generated Release bundle phase is malformed or disabled.');
  }
  const encodedScript = readPbxValue(bundlePhase.body, 'shellScript');
  if (encodedScript === undefined) {
    throw new Error('Generated Release bundle phase is malformed or disabled.');
  }
  const script = decodePbxShellScript(encodedScript);
  if (!script.includes('react-native-xcode.sh')) {
    throw new Error(
      'Generated Release bundle phase does not invoke React Native bundling.',
    );
  }
  if (
    !script.includes('.xcode.env') ||
    !script.includes('resolveAppEntry') ||
    !script.includes('@expo/cli') ||
    !script.includes('BUNDLE_COMMAND') ||
    !script.includes('export:embed')
  ) {
    throw new Error(
      'Generated Release bundle phase does not use the Expo embed wrapper.',
    );
  }
  const debugSkipPattern =
    /if\s*\[\[\s*"?\$CONFIGURATION"?\s*=\s*\*Debug\*\s*\]\]\s*;\s*then\s+export\s+SKIP_BUNDLING\s*=\s*1\s+fi/s;
  if (!debugSkipPattern.test(script)) {
    throw new Error(
      'Generated Release bundle phase does not preserve Debug Metro behavior.',
    );
  }
  const releaseResetPattern =
    /if\s*\[\[\s*"?\$CONFIGURATION"?\s*!=\s*\*Debug\*\s*\]\]\s*;\s*then\s+unset\s+SKIP_BUNDLING\s+fi/s;
  if (!releaseResetPattern.test(script)) {
    throw new Error(
      'Generated Release bundle phase does not clear inherited skip flags.',
    );
  }
  if (
    script
      .replace(debugSkipPattern, '')
      .replace(releaseResetPattern, '')
      .match(/(?:^|\n)\s*(?:export\s+)?SKIP_BUNDLING\s*=\s*[^\s;]+/g)?.length
  ) {
    throw new Error(
      'Generated Release bundle phase skips bundling outside Debug.',
    );
  }
}

function readPodfileTargetBlock(
  podfileText: string,
  targetName: string,
): string | undefined {
  const lines = podfileText.split(/\r?\n/);
  const targetPattern = new RegExp(
    `^\\s*target\\s+['"]${targetName}['"]\\s+do\\s*$`,
  );
  const start = lines.findIndex((line) => targetPattern.test(line));
  if (start < 0) return undefined;
  let depth = 0;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (index === start) {
      depth = 1;
    } else {
      if (/^\s*(?:if|unless|case|begin|def|class|module)\b/.test(line)) {
        depth += 1;
      }
      depth += (line.match(/\bdo\b/g) ?? []).length;
      depth -= (line.match(/\bend\b/g) ?? []).length;
    }
    if (depth === 0) return lines.slice(start, index + 1).join('\n');
  }
  return undefined;
}

function assertStaticFrameworkConfiguration(
  iosDirectory: string,
  podfileText: string,
  environment: Partial<NodeJS.ProcessEnv> = {},
): void {
  const propertiesPath = join(iosDirectory, 'Podfile.properties.json');
  if (!existsSync(propertiesPath)) {
    throw new Error('Generated static framework properties file is missing.');
  }
  let properties: unknown;
  try {
    properties = JSON.parse(readFileSync(propertiesPath, 'utf8')) as unknown;
  } catch {
    throw new Error('Generated static framework properties file is malformed.');
  }
  if (typeof properties !== 'object' || properties === null) {
    throw new Error('Generated static framework properties file is malformed.');
  }
  const linkage = (properties as Record<string, unknown>)['ios.useFrameworks'];
  if (linkage === undefined) {
    throw new Error(
      'Generated static framework property ios.useFrameworks is missing.',
    );
  }
  if (linkage !== 'static') {
    throw new Error('Generated static framework linkage is not static.');
  }
  if (
    !/JSON\.parse\s*\(\s*File\.read\s*\(\s*File\.join\(\s*__dir__\s*,\s*['"]Podfile\.properties\.json['"]\s*\)\s*\)/.test(
      podfileText,
    )
  ) {
    throw new Error(
      'Generated Podfile does not load static framework properties.',
    );
  }
  const targetBlock = readPodfileTargetBlock(podfileText, 'FoodTracker');
  if (targetBlock === undefined) {
    throw new Error('Generated Podfile is missing the FoodTracker target.');
  }
  if (
    !/use_frameworks!\s*:linkage\s*=>\s*podfile_properties\s*\[['"]ios\.useFrameworks['"]\]\s*\.to_sym\s+if\s+podfile_properties\s*\[['"]ios\.useFrameworks['"]\]/.test(
      targetBlock,
    )
  ) {
    throw new Error(
      'Generated FoodTracker target does not use ios.useFrameworks for linkage.',
    );
  }
  if (/use_frameworks!\s*:linkage\s*=>\s*:dynamic\b/.test(targetBlock)) {
    throw new Error('Generated Podfile contains a dynamic framework override.');
  }
  const environmentLinkage = environment.USE_FRAMEWORKS?.trim();
  if (environmentLinkage !== undefined && environmentLinkage !== '') {
    if (environmentLinkage !== 'static') {
      throw new Error(
        'Generated Podfile contains a dynamic framework override.',
      );
    }
  }
  const podfileLockPath = join(iosDirectory, 'Podfile.lock');
  if (!existsSync(podfileLockPath)) {
    throw new Error('Generated Firebase native pod integration is missing.');
  }
  const podfileLockText = readFileSync(podfileLockPath, 'utf8');
  if (
    !/\bRNFBApp\b/.test(podfileLockText) ||
    !/\bRNFBAuth\b/.test(podfileLockText) ||
    !/\bFirebase(?:\/Auth|Auth|CoreOnly)\b/.test(podfileLockText)
  ) {
    throw new Error('Generated Firebase native pod integration is missing.');
  }
  const targetSupportConfig = join(
    iosDirectory,
    'Pods',
    'Target Support Files',
    'Pods-FoodTracker',
    'Pods-FoodTracker.release.xcconfig',
  );
  if (!existsSync(targetSupportConfig)) {
    throw new Error('Generated static framework target support is missing.');
  }
}

export function cleanupGeneratedIosDirectory(
  rootDir: string,
  dependencies: Pick<
    WorkflowDependencies,
    'isIgnored' | 'isTracked' | 'removeDirectory'
  > = {},
): void {
  const iosDirectory = resolveWorkflowPaths(rootDir).iosDirectory;
  if (!existsSync(iosDirectory)) return;
  assertSafeGeneratedIosDirectory(iosDirectory, rootDir, dependencies);
  assertNoSymlinkedNativeChildren(iosDirectory);
  (dependencies.removeDirectory ?? defaultRemoveDirectory)(iosDirectory);
}

export function buildPreparationCommands(rootDir: string): WorkflowCommand[] {
  const paths = resolveWorkflowPaths(rootDir);
  return [
    {
      command: 'corepack',
      args: [
        'pnpm',
        'exec',
        'expo',
        'prebuild',
        '--clean',
        '--platform',
        'ios',
        '--no-install',
      ],
      cwd: paths.mobileDirectory,
    },
    {
      command: 'pod',
      args: ['install', '--repo-update'],
      cwd: paths.iosDirectory,
    },
    {
      command: 'open',
      args: ['-a', 'Xcode', paths.workspacePath],
      cwd: paths.rootDir,
    },
  ];
}

export function validateGeneratedReleaseConfiguration(
  iosDirectory: string,
  config: StagingReleaseConfig,
  environment: Partial<NodeJS.ProcessEnv> = {},
): void {
  const workspace = join(iosDirectory, 'FoodTracker.xcworkspace');
  const project = join(
    iosDirectory,
    'FoodTracker.xcodeproj',
    'project.pbxproj',
  );
  const infoPlist = join(iosDirectory, 'FoodTracker', 'Info.plist');
  const firebasePlist = join(
    iosDirectory,
    'FoodTracker',
    'GoogleService-Info.plist',
  );
  const podfile = join(iosDirectory, 'Podfile');
  for (const path of [workspace, project, infoPlist, firebasePlist, podfile]) {
    if (!existsSync(path))
      throw new Error('Generated iOS Release state is incomplete.');
  }
  const projectText = readFileSync(project, 'utf8');
  const infoText = readFileSync(infoPlist, 'utf8');
  const podfileText = readFileSync(podfile, 'utf8');
  if (
    !projectText.includes(
      `PRODUCT_BUNDLE_IDENTIFIER = ${config.firebase.bundleIdentifier};`,
    )
  ) {
    throw new Error(
      'Generated Release bundle identifier does not match the existing app.',
    );
  }
  assertGeneratedReleaseMetadata(
    projectText,
    infoText,
    config.firebase.bundleIdentifier,
  );
  assertGeneratedSceneLifecycle(iosDirectory, projectText, infoText);
  assertGeneratedDeploymentTargets(iosDirectory, projectText);
  if (projectText.includes('DEVELOPMENT_TEAM =')) {
    throw new Error(
      'Generated native state contains a tracked signing-team value.',
    );
  }
  assertGeneratedReleaseBundleConfiguration(projectText);
  assertStaticFrameworkConfiguration(iosDirectory, podfileText, environment);
  if (
    !infoText.includes('NSCameraUsageDescription') ||
    !infoText.includes('NSPhotoLibraryUsageDescription')
  ) {
    throw new Error('Generated camera/photo permissions are missing.');
  }
  const escapedScheme = config.googleIosUrlScheme.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  const schemePattern = new RegExp(
    `<key>CFBundleURLSchemes</key>\\s*<array>\\s*<string>${escapedScheme}</string>`,
  );
  if (!schemePattern.test(infoText)) {
    throw new Error('Generated Google URL scheme is missing.');
  }
  const generatedPlist = readFileSync(firebasePlist, 'utf8');
  if (!generatedPlist.includes('<key>BUNDLE_ID</key>')) {
    throw new Error('Generated Firebase plist is missing.');
  }
  const generatedFirebase = validateFirebasePlist(
    firebasePlist,
    config.firebase.bundleIdentifier,
  );
  if (
    generatedFirebase.projectId !== config.firebase.projectId ||
    generatedFirebase.googleAppId !== config.firebase.googleAppId ||
    generatedFirebase.clientId !== config.firebase.clientId ||
    generatedFirebase.reversedClientId !== config.firebase.reversedClientId
  ) {
    throw new Error(
      'Generated Firebase plist does not match the validated source.',
    );
  }
  const entitlements = join(
    iosDirectory,
    'FoodTracker',
    'FoodTracker.entitlements',
  );
  if (
    existsSync(entitlements) &&
    readFileSync(entitlements, 'utf8').includes(
      'com.apple.developer.applesignin',
    )
  ) {
    throw new Error(
      'Generated Release state unexpectedly enables Apple Sign In.',
    );
  }
}

function apiTargetCandidates(bundle: Buffer): string[] {
  const text = bundle.toString('utf8');
  const matches = text.match(/https?:\/\/[A-Za-z0-9._:-]+(?::\d+)?\/api\/v1/g);
  return [...new Set(matches ?? [])];
}

function isPrivateOrLocalApiTarget(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return true;
  }
  const hostname = url.hostname.toLowerCase();
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
  if (
    url.protocol !== 'https:' ||
    normalizedHostname === 'localhost' ||
    normalizedHostname.endsWith('.local') ||
    normalizedHostname === '0.0.0.0' ||
    normalizedHostname === '::1' ||
    /^fe80:/i.test(normalizedHostname) ||
    /^(?:fc|fd)[0-9a-f:]+$/i.test(normalizedHostname) ||
    normalizedHostname.startsWith('127.') ||
    normalizedHostname.startsWith('10.') ||
    normalizedHostname.startsWith('192.168.') ||
    normalizedHostname.startsWith('169.254.')
  ) {
    return true;
  }
  const ipv4 = normalizedHostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4 !== null) {
    const first = Number(ipv4[1]);
    const second = Number(ipv4[2]);
    if (first === 172 && second >= 16 && second <= 31) {
      return true;
    }
  }
  return false;
}

function assertReleaseArtifactMetadata(
  appDirectory: string,
  expectedBundleIdentifier: string,
): void {
  const infoPath = join(appDirectory, 'Info.plist');
  try {
    const stat = lstatSync(infoPath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error();
    const info = readFileSync(infoPath, 'utf8');
    if (
      readPlistString(info, 'CFBundleIdentifier') !==
        expectedBundleIdentifier ||
      readPlistString(info, 'CFBundleShortVersionString') !== APP_VERSION ||
      readPlistString(info, 'CFBundleVersion') !== IOS_BUILD_NUMBER
    ) {
      throw new Error();
    }
  } catch {
    throw new Error('Built Release app metadata is not canonical.');
  }
}

export function assertReleaseBundleArtifact(
  appDirectory: string,
  config: StagingReleaseConfig,
): void {
  if (config.appEnvironment !== 'staging') {
    throw new Error('Validated Release artifact configuration is not staging.');
  }
  try {
    const appStat = lstatSync(appDirectory);
    if (!appStat.isDirectory() || appStat.isSymbolicLink()) throw new Error();
  } catch {
    throw new Error('Built Release app artifact is not a regular directory.');
  }
  const bundlePath = join(appDirectory, 'main.jsbundle');
  let bundle: Buffer;
  try {
    const stat = lstatSync(bundlePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) {
      throw new Error();
    }
    bundle = readFileSync(bundlePath);
  } catch {
    throw new Error('Built Release app is missing its JavaScript bundle.');
  }
  assertReleaseArtifactMetadata(appDirectory, config.firebase.bundleIdentifier);
  const candidates = apiTargetCandidates(bundle);
  if (candidates.length === 0) {
    throw new Error('Built Release app does not contain a staging API target.');
  }
  if (candidates.some(isPrivateOrLocalApiTarget)) {
    throw new Error('Built Release app contains an unsafe API target.');
  }
  const bundleText = bundle.toString('utf8');
  if (
    /appEnvironment\s*["']?\s*[:=]\s*["'](?:development|production)["']/.test(
      bundleText,
    )
  ) {
    throw new Error(
      'Built Release app does not contain a staging environment.',
    );
  }
  let expected: URL;
  try {
    expected = new URL(config.apiUrl);
  } catch {
    throw new Error('Validated staging API target is malformed.');
  }
  const expectedValue = expected.toString().replace(/\/$/, '');
  const hasExpectedTarget = candidates.some((candidate) => {
    try {
      return new URL(candidate).toString().replace(/\/$/, '') === expectedValue;
    } catch {
      return false;
    }
  });
  if (!hasExpectedTarget) {
    throw new Error(
      'Built Release app does not contain the validated staging API target.',
    );
  }
}

export function findNewestReleaseArtifact(
  searchRoot = join(homedir(), 'Library/Developer/Xcode/DerivedData'),
): string {
  const candidates: Array<{ path: string; modified: number }> = [];
  const pending = [searchRoot];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const child = join(current, entry.name);
      if (!entry.isDirectory()) continue;
      if (entry.name === 'Release-iphoneos') {
        const app = join(child, 'FoodTracker.app');
        try {
          const appStat = lstatSync(app);
          if (appStat.isDirectory() && !appStat.isSymbolicLink()) {
            candidates.push({ path: app, modified: appStat.mtimeMs });
          }
        } catch {
          // Ignore incomplete or concurrently removed build products.
        }
        continue;
      }
      pending.push(child);
    }
  }
  candidates.sort((left, right) => right.modified - left.modified);
  const newest = candidates[0];
  if (newest === undefined) {
    throw new Error('No Release-iphoneos FoodTracker artifact was found.');
  }
  return newest.path;
}

export function loadValidatedStagingReleaseConfig(
  envFilePath = resolveWorkflowPaths().envFilePath,
): StagingReleaseConfig {
  const fileEnvironment = loadStagingReleaseEnvFile(envFilePath);
  validateStagingReleaseEnvFileVariables(fileEnvironment);
  return validateStagingReleaseEnvironment(fileEnvironment, {
    requireRailwayHost: true,
  });
}

function validateToolchain(
  rootDir: string,
  capture: WorkflowDependencies['captureCommand'],
  skipDeviceCheck: boolean,
): void {
  if (!process.version.startsWith('v22.')) {
    throw new Error('Node 22.x is required for the staging Release workflow.');
  }
  const runCapture = capture ?? defaultCaptureCommand;
  const pnpmVersion = runCapture('corepack', ['pnpm', '-v'], rootDir).trim();
  if (pnpmVersion !== '10.34.3') {
    throw new Error(
      'pnpm 10.34.3 is required for the staging Release workflow.',
    );
  }
  runCapture('xcode-select', ['-p'], rootDir);
  runCapture('xcodebuild', ['-version'], rootDir);
  runCapture('xcodebuild', ['-checkFirstLaunchStatus'], rootDir);
  runCapture('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path'], rootDir);
  runCapture('pod', ['--version'], rootDir);
  if (!skipDeviceCheck) {
    const devices = runCapture('xcrun', ['xcdevice', 'list'], rootDir);
    if (!hasConnectedPhysicalIPhone(devices)) {
      throw new Error("Josh's trusted iPhone is not discoverable by Xcode.");
    }
  }
  const disk = runCapture('df', ['-Pk', rootDir], rootDir);
  const availableKb = Number(disk.trim().split(/\s+/).at(-3) ?? 0);
  if (!Number.isFinite(availableKb) || availableKb < 10 * 1024 * 1024) {
    throw new Error(
      'At least 10 GiB of free disk space is required before prebuild.',
    );
  }
}

export function runStagingReleasePreparation(
  options: PreparationOptions = {},
): StagingReleaseConfig {
  const paths = resolveWorkflowPaths(options.rootDir);
  const rootDir = paths.rootDir;
  const envFilePath = options.envFilePath ?? paths.envFilePath;
  const beforeStatus = (options.readStatus ?? defaultReadStatus)(rootDir);
  assertRequiredBranch(rootDir, options.captureCommand);
  assertNoStagedFiles(rootDir, options.captureCommand);
  if (!options.skipToolchainChecks) {
    validateToolchain(
      rootDir,
      options.captureCommand,
      options.skipDeviceCheck ?? false,
    );
  }

  const fileEnvironment = loadStagingReleaseEnvFile(envFilePath);
  validateStagingReleaseEnvFileVariables(fileEnvironment);
  if (
    Object.prototype.hasOwnProperty.call(
      process.env,
      'EXPO_NO_CLIENT_ENV_VARS',
    ) ||
    Object.prototype.hasOwnProperty.call(
      fileEnvironment,
      'EXPO_NO_CLIENT_ENV_VARS',
    )
  ) {
    throw new Error(
      'EXPO_NO_CLIENT_ENV_VARS must be unset before starting this workflow.',
    );
  }
  const childEnvironment = {
    ...process.env,
    ...fileEnvironment,
    EXPO_NO_DOTENV: '1',
  } as NodeJS.ProcessEnv;
  // React Native's Xcode bundling script treats any inherited value as an
  // explicit request to skip bundling. Release handoff must never inherit
  // that Debug-only escape hatch from the shell that launched Xcode.
  delete childEnvironment.SKIP_BUNDLING;
  delete childEnvironment.EXPO_NO_CLIENT_ENV_VARS;
  const config = validateStagingReleaseEnvironment(childEnvironment, {
    requireRailwayHost: true,
  });
  const iosDirectory = paths.iosDirectory;
  assertSafeGeneratedIosDirectory(iosDirectory, rootDir, options);
  if (existsSync(iosDirectory)) assertNoSymlinkedNativeChildren(iosDirectory);
  const run = options.runCommand ?? defaultRunCommand;
  const commands = buildPreparationCommands(rootDir);
  for (const command of commands.slice(0, 2)) {
    run(command.command, command.args, command.cwd, childEnvironment);
  }
  assertSafeGeneratedIosDirectory(iosDirectory, rootDir, options);
  assertNoSymlinkedNativeChildren(iosDirectory);
  // The prebuild recreates `.xcode.env.local`; write the durable staging
  // handoff after native generation and CocoaPods have completed, immediately
  // before the generated-state guards and Xcode handoff.
  writeStagingReleaseXcodeEnvironmentFile(
    iosDirectory,
    rootDir,
    config,
    options,
    process.execPath,
  );
  assertSafeGeneratedIosDirectory(iosDirectory, rootDir, options);
  assertNoSymlinkedNativeChildren(iosDirectory);
  validateGeneratedReleaseConfiguration(iosDirectory, config, childEnvironment);
  const afterStatus = (options.readStatus ?? defaultReadStatus)(rootDir);
  if (afterStatus !== beforeStatus) {
    throw new Error(
      'Native preparation changed tracked or unrelated Git state.',
    );
  }
  const openCommand = commands[2];
  if (openCommand === undefined)
    throw new Error('Xcode handoff command was not generated.');
  run(openCommand.command, openCommand.args, openCommand.cwd, childEnvironment);
  return config;
}
