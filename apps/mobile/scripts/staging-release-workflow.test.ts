import {
  accessSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertSafeGeneratedIosDirectory,
  assertRequiredStagingReleaseBranch,
  assertReleaseBundleArtifact,
  buildPreparationCommands,
  cleanupGeneratedIosDirectory,
  findNewestReleaseArtifact,
  hasConnectedPhysicalIPhone,
  MOBILE_DIRECTORY,
  REPOSITORY_ROOT,
  resolveWorkflowPaths,
  runStagingReleasePreparation,
  validateGeneratedReleaseConfiguration,
  writeStagingReleaseXcodeEnvironmentFile,
} from './staging-release-workflow';
import type { StagingReleaseConfig } from './staging-release-config';

const temporaryDirectories: string[] = [];

function tempDirectory(): string {
  const directory = mkdtempSync(
    join(tmpdir(), 'food-tracker-phase17-workflow-'),
  );
  temporaryDirectories.push(directory);
  return directory;
}

function stagingConfig(): StagingReleaseConfig {
  return {
    apiUrl: 'https://api.railway.test/api/v1',
    appEnvironment: 'staging',
    googleIosUrlScheme: 'com.googleusercontent.apps.release',
    googleWebClientId: 'web-client',
    googleServicesPlistPath: '/tmp/GoogleService-Info.plist',
    firebase: {
      bundleIdentifier: 'ca.joshuaaryeetey.foodtracker',
      projectId: 'project',
      googleAppId: 'app',
      clientId: 'client',
      reversedClientId: 'com.googleusercontent.apps.release',
    },
    sanitized: {},
  };
}

function writeReleaseArtifactFixture(
  root: string,
  bundleContents: string,
): string {
  const appDirectory = join(root, 'FoodTracker.app');
  mkdirSync(appDirectory, { recursive: true });
  writeFileSync(
    join(appDirectory, 'Info.plist'),
    `<plist><dict>
<key>CFBundleIdentifier</key><string>ca.joshuaaryeetey.foodtracker</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
</dict></plist>`,
  );
  writeFileSync(join(appDirectory, 'main.jsbundle'), bundleContents);
  return appDirectory;
}

function encodeShellScript(script: string): string {
  return script
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function bundleProjectFixture(
  options: {
    targetHasPhase?: boolean;
    wrongTargetOwnsPhase?: boolean;
    includePhase?: boolean;
    phaseScript?: string;
    buildActionMask?: string;
    runOnlyForDeploymentPostprocessing?: string;
  } = {},
): string {
  const phaseId = '00DD1BFF1BD5951E006B06BC';
  const sourcesPhaseId = '00DD1BFF1BD5951E006B06BD';
  const phaseScript =
    options.phaseScript ??
    [
      'source .xcode.env',
      'export PROJECT_ROOT="$PROJECT_DIR"/..',
      'if [[ "$CONFIGURATION" = *Debug* ]]; then',
      '  export SKIP_BUNDLING=1',
      'fi',
      'if [[ "$CONFIGURATION" != *Debug* ]]; then',
      '  unset SKIP_BUNDLING',
      'fi',
      'export ENTRY_FILE="expo/scripts/resolveAppEntry"',
      'export CLI_PATH="@expo/cli"',
      'if [[ -z "$BUNDLE_COMMAND" ]]; then',
      '  export BUNDLE_COMMAND="export:embed"',
      'fi',
      'node --print "react-native/scripts/react-native-xcode.sh"',
    ].join('\n');
  return `
/* Begin PBXNativeTarget section */
  13B07F861A680F5B00A75B9A /* FoodTracker */ = {
    isa = PBXNativeTarget;
    buildPhases = (
      ${sourcesPhaseId} /* Sources */, 
      ${options.targetHasPhase === false ? '' : `${phaseId} /* Bundle React Native code and images */,`}
    );
    name = FoodTracker;
    productType = "com.apple.product-type.application";
  };
${
  options.wrongTargetOwnsPhase === true
    ? `
  13B07F861A680F5B00A75B9C /* OtherTarget */ = {
    isa = PBXNativeTarget;
    buildPhases = (
      ${phaseId} /* Bundle React Native code and images */,
    );
    name = OtherTarget;
    productType = "com.apple.product-type.application";
  };
`
    : ''
}
/* End PBXNativeTarget section */
/* Begin PBXBuildFile section */
  00DD1BFF1BD5951E006B06BF /* SceneDelegate.swift in Sources */ = {
    isa = PBXBuildFile;
    fileRef = 00DD1BFF1BD5951E006B06C0 /* SceneDelegate.swift */;
  };
/* End PBXBuildFile section */
/* Begin PBXFileReference section */
  00DD1BFF1BD5951E006B06C0 /* SceneDelegate.swift */ = {
    isa = PBXFileReference;
    lastKnownFileType = sourcecode.swift;
    path = FoodTracker/SceneDelegate.swift;
    sourceTree = "<group>";
  };
/* End PBXFileReference section */
/* Begin PBXSourcesBuildPhase section */
  ${sourcesPhaseId} /* Sources */ = {
    isa = PBXSourcesBuildPhase;
    files = (
      00DD1BFF1BD5951E006B06BF /* SceneDelegate.swift in Sources */,
    );
  };
/* End PBXSourcesBuildPhase section */
/* Begin PBXShellScriptBuildPhase section */
${
  options.includePhase === false
    ? ''
    : `
  ${phaseId} /* Bundle React Native code and images */ = {
    isa = PBXShellScriptBuildPhase;
    buildActionMask = ${options.buildActionMask ?? '2147483647'};
    name = "Bundle React Native code and images";
    runOnlyForDeploymentPostprocessing = ${options.runOnlyForDeploymentPostprocessing ?? '0'};
    shellPath = /bin/sh;
    shellScript = "${encodeShellScript(phaseScript)}";
  };
`
}
/* End PBXShellScriptBuildPhase section */
`;
}

function staticFrameworkFixture(
  options: {
    properties?: string;
    podfile?: string;
    podfileLock?: string;
    includeSupportFiles?: boolean;
    includePropertiesFile?: boolean;
  } = {},
): {
  properties: string | undefined;
  podfile: string;
  podfileLock: string;
  includeSupportFiles: boolean;
} {
  return {
    properties:
      options.includePropertiesFile === false
        ? undefined
        : (options.properties ?? '{"ios.useFrameworks":"static"}'),
    podfile:
      options.podfile ??
      `require 'json'
podfile_properties = JSON.parse(File.read(File.join(__dir__, 'Podfile.properties.json'))) rescue {}

target 'FoodTracker' do
  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']
end
`,
    podfileLock:
      options.podfileLock ??
      `PODS:
  - RNFBApp
  - RNFBAuth
  - Firebase/Auth

DEPENDENCIES:
  - RNFBApp
  - RNFBAuth
`,
    includeSupportFiles: options.includeSupportFiles ?? true,
  };
}

function writeGeneratedReleaseFixture(
  root: string,
  options: {
    infoVersion?: string;
    infoBuildNumber?: string;
    debugMarketingVersion?: string;
    releaseMarketingVersion?: string;
    debugBuildNumber?: string;
    releaseBuildNumber?: string;
    projectMarketingVersion?: string;
    projectBuildNumber?: string;
    bundleProject?: string;
    staticFrameworks?: ReturnType<typeof staticFrameworkFixture>;
  } = {},
): void {
  const ios = join(root, 'apps/mobile/ios');
  mkdirSync(join(ios, 'FoodTracker.xcworkspace'), { recursive: true });
  mkdirSync(join(ios, 'FoodTracker.xcodeproj'), { recursive: true });
  mkdirSync(join(ios, 'FoodTracker'), { recursive: true });
  const debugMarketingVersion = options.debugMarketingVersion ?? '1.0';
  const releaseMarketingVersion = options.releaseMarketingVersion ?? '1.0';
  const debugBuildNumber = options.debugBuildNumber ?? '1';
  const releaseBuildNumber = options.releaseBuildNumber ?? '1';
  const projectSettings =
    options.projectMarketingVersion === undefined &&
    options.projectBuildNumber === undefined
      ? ''
      : `13B07F96 /* Debug */ = {
  isa = XCBuildConfiguration;
  buildSettings = {
    CURRENT_PROJECT_VERSION = ${options.projectBuildNumber ?? '1'};
    MARKETING_VERSION = ${options.projectMarketingVersion ?? '1.0'};
  };
  name = Debug;
};`;
  writeFileSync(
    join(ios, 'FoodTracker.xcodeproj/project.pbxproj'),
    `
13B07F94 /* Debug */ = {
  isa = XCBuildConfiguration;
  buildSettings = {
    CURRENT_PROJECT_VERSION = ${debugBuildNumber};
    INFOPLIST_FILE = FoodTracker/Info.plist;
    IPHONEOS_DEPLOYMENT_TARGET = 16.4;
    MARKETING_VERSION = ${debugMarketingVersion};
    PRODUCT_BUNDLE_IDENTIFIER = ca.joshuaaryeetey.foodtracker;
  };
  name = Debug;
};
13B07F95 /* Release */ = {
  isa = XCBuildConfiguration;
  buildSettings = {
    CURRENT_PROJECT_VERSION = ${releaseBuildNumber};
    INFOPLIST_FILE = FoodTracker/Info.plist;
    IPHONEOS_DEPLOYMENT_TARGET = 16.4;
    MARKETING_VERSION = ${releaseMarketingVersion};
    PRODUCT_BUNDLE_IDENTIFIER = ca.joshuaaryeetey.foodtracker;
  };
  name = Release;
};
PRODUCT_BUNDLE_IDENTIFIER = ca.joshuaaryeetey.foodtracker;
${projectSettings}
${options.bundleProject ?? bundleProjectFixture()}
`,
  );
  writeFileSync(
    join(ios, 'FoodTracker/Info.plist'),
    `<plist><dict>
<key>CFBundleShortVersionString</key><string>${options.infoVersion ?? '0.1.0'}</string>
<key>CFBundleVersion</key><string>${options.infoBuildNumber ?? '1'}</string>
<key>NSCameraUsageDescription</key><string>camera</string>
<key>NSPhotoLibraryUsageDescription</key><string>photos</string>
<key>CFBundleURLSchemes</key><array><string>com.googleusercontent.apps.release</string></array>
<key>UIApplicationSceneManifest</key><dict>
<key>UIApplicationSupportsMultipleScenes</key><false/>
<key>UISceneConfigurations</key><dict>
<key>UIWindowSceneSessionRoleApplication</key><array><dict>
<key>UISceneConfigurationName</key><string>Default Configuration</string>
<key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
</dict></array></dict></dict>
</dict></plist>`,
  );
  writeFileSync(
    join(ios, 'FoodTracker/AppDelegate.swift'),
    `class AppDelegate: ExpoAppDelegate {
  public func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
    UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
  }
}`,
  );
  writeFileSync(
    join(ios, 'FoodTracker/SceneDelegate.swift'),
    `final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    let windowScene = scene as! UIWindowScene
    let window = UIWindow(windowScene: windowScene)
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: nil)
  }
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {}
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {}
  private func handle(url: URL) { _ = appDelegate.application(UIApplication.shared, open: url, options: [:]) }
}`,
  );
  writeFileSync(
    join(ios, 'FoodTracker/GoogleService-Info.plist'),
    '<plist><dict><key>BUNDLE_ID</key><string>ca.joshuaaryeetey.foodtracker</string><key>PROJECT_ID</key><string>project</string><key>GOOGLE_APP_ID</key><string>app</string><key>CLIENT_ID</key><string>client</string><key>REVERSED_CLIENT_ID</key><string>com.googleusercontent.apps.release</string><key>API_KEY</key><string>key</string></dict></plist>',
  );
  const staticFrameworks = options.staticFrameworks ?? staticFrameworkFixture();
  writeFileSync(
    join(ios, 'Podfile'),
    staticFrameworks?.podfile ?? 'use_frameworks! :linkage => :static',
  );
  if (staticFrameworks?.properties !== undefined) {
    writeFileSync(
      join(ios, 'Podfile.properties.json'),
      staticFrameworks.properties,
    );
  }
  if (staticFrameworks?.podfileLock !== undefined) {
    writeFileSync(join(ios, 'Podfile.lock'), staticFrameworks.podfileLock);
  }
  if (staticFrameworks?.includeSupportFiles) {
    mkdirSync(join(ios, 'Pods/Target Support Files/Pods-FoodTracker'), {
      recursive: true,
    });
    writeFileSync(
      join(
        ios,
        'Pods/Target Support Files/Pods-FoodTracker/Pods-FoodTracker.release.xcconfig',
      ),
      'OTHER_LDFLAGS = -lRNFBApp -lRNFBAuth',
    );
  }
  writePodsProjectFixture(root, ['16.4', '16.4']);
}

function writePodsProjectFixture(
  root: string,
  deploymentTargets: string[],
): void {
  const podsProject = join(root, 'apps/mobile/ios/Pods/Pods.xcodeproj');
  mkdirSync(podsProject, { recursive: true });
  writeFileSync(
    join(podsProject, 'project.pbxproj'),
    deploymentTargets
      .map(
        (target, index) => `
${String(index + 1).padStart(24, '0')} /* Pod ${index + 1} */ = {
  isa = XCBuildConfiguration;
  buildSettings = {
    IPHONEOS_DEPLOYMENT_TARGET = ${target};
  };
};`,
      )
      .join('\n'),
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('staging Release workflow', () => {
  it.each([
    'phase-17-5-custom-analytics',
    'phase-17-free-xcode-standalone',
    'main',
  ])('accepts the explicit staging Release branch %s', (branch) => {
    expect(() =>
      assertRequiredStagingReleaseBranch('/repository', () => `${branch}\n`),
    ).not.toThrow();
  });

  it('rejects an unrelated staging Release branch', () => {
    expect(() =>
      assertRequiredStagingReleaseBranch(
        '/repository',
        () => 'feature/other\n',
      ),
    ).toThrow(
      'requires an approved Phase 17 staging branch or post-merge main',
    );
  });

  it('resolves the environment file from the canonical mobile root', () => {
    const paths = resolveWorkflowPaths();

    expect(paths.rootDir).toBe(REPOSITORY_ROOT);
    expect(paths.mobileDirectory).toBe(MOBILE_DIRECTORY);
    expect(paths.envFilePath).toBe(
      join(MOBILE_DIRECTORY, '.env.staging-release.local'),
    );
    expect(paths.envFilePath).not.toContain('apps/mobile/apps/mobile');
  });

  it('keeps the same paths when the caller is the mobile workspace', () => {
    const originalWorkingDirectory = process.cwd();
    process.chdir(MOBILE_DIRECTORY);
    try {
      const paths = resolveWorkflowPaths();
      expect(paths.rootDir).toBe(REPOSITORY_ROOT);
      expect(paths.envFilePath).toBe(
        join(MOBILE_DIRECTORY, '.env.staging-release.local'),
      );
    } finally {
      process.chdir(originalWorkingDirectory);
    }
  });

  it('accepts canonical Info.plist metadata with the Expo iOS template setting', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root);

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      ),
    ).not.toThrow();
  });

  it('rejects a generated iOS project without the application scene manifest', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root);
    const infoPath = join(root, 'apps/mobile/ios/FoodTracker/Info.plist');
    writeFileSync(
      infoPath,
      readFileSync(infoPath, 'utf8').replace(
        /<key>UIApplicationSceneManifest<\/key>[\s\S]*?<\/dict>\n<\/dict>/,
        '</dict>',
      ),
    );

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      ),
    ).toThrow('scene lifecycle configuration');
  });

  it('rejects a generated iOS project without SceneDelegate source', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root);
    rmSync(join(root, 'apps/mobile/ios/FoodTracker/SceneDelegate.swift'));

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      ),
    ).toThrow('scene lifecycle source');
  });

  it('rejects an AppDelegate without scene configuration', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root);
    writeFileSync(
      join(root, 'apps/mobile/ios/FoodTracker/AppDelegate.swift'),
      'class AppDelegate: ExpoAppDelegate {}',
    );

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      ),
    ).toThrow('AppDelegate');
  });

  it('resolves Info.plist build-setting substitutions for both configurations', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root, {
      infoVersion: '$(MARKETING_VERSION)',
      infoBuildNumber: '$(CURRENT_PROJECT_VERSION)',
      debugMarketingVersion: '0.1.0',
      releaseMarketingVersion: '0.1.0',
    });

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      ),
    ).not.toThrow();
  });

  it('uses target metadata instead of unrelated project-level settings', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root, {
      projectMarketingVersion: '0.2.0',
      projectBuildNumber: '9',
    });

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      ),
    ).not.toThrow();
  });

  it.each([{ infoVersion: '0.2.0' }, { infoBuildNumber: '2' }])(
    'rejects mismatched literal metadata %#',
    (options) => {
      const root = tempDirectory();
      writeGeneratedReleaseFixture(root, options);

      expect(() =>
        validateGeneratedReleaseConfiguration(
          join(root, 'apps/mobile/ios'),
          stagingConfig(),
        ),
      ).toThrow('version/build metadata');
    },
  );

  it('rejects Debug and Release substitution disagreement even when project settings look canonical', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root, {
      infoVersion: '$(MARKETING_VERSION)',
      infoBuildNumber: '$(CURRENT_PROJECT_VERSION)',
      debugMarketingVersion: '0.1.0',
      releaseMarketingVersion: '0.2.0',
      projectMarketingVersion: '0.1.0',
      projectBuildNumber: '1',
    });

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      ),
    ).toThrow('version/build metadata');
  });

  it('accepts the FoodTracker Release bundle phase without a prebuilt artifact', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root, {
      bundleProject: bundleProjectFixture(),
    });

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      ),
    ).not.toThrow();
  });

  it('accepts a non-empty staging-target main.jsbundle in a built Release app', () => {
    const root = tempDirectory();
    const appDirectory = writeReleaseArtifactFixture(
      root,
      'const apiUrl = "https://api.railway.test/api/v1"; appEnvironment = "staging";',
    );

    expect(() =>
      assertReleaseBundleArtifact(appDirectory, stagingConfig()),
    ).not.toThrow();
  });

  it.each([
    { name: 'missing', contents: undefined },
    { name: 'empty', contents: '' },
  ])('rejects a $name Release artifact bundle', ({ contents }) => {
    const root = tempDirectory();
    const appDirectory = join(root, 'FoodTracker.app');
    mkdirSync(appDirectory, { recursive: true });
    if (contents !== undefined) {
      writeFileSync(join(appDirectory, 'main.jsbundle'), contents);
    }

    expect(() =>
      assertReleaseBundleArtifact(appDirectory, stagingConfig()),
    ).toThrow('missing its JavaScript bundle');
  });

  it.each([
    'const apiUrl = "http://10.42.0.7:3000/api/v1"; appEnvironment = "development";',
    'const apiUrl = "https://api.railway.test/api/v1"; appEnvironment = "development";',
    'const apiUrl = "https://api.other.test/api/v1"; appEnvironment = "staging";',
  ])(
    'rejects a Release artifact with an unsafe or wrong API target',
    (contents) => {
      const root = tempDirectory();
      const appDirectory = writeReleaseArtifactFixture(root, contents);

      expect(() =>
        assertReleaseBundleArtifact(appDirectory, stagingConfig()),
      ).toThrow();
    },
  );

  it('rejects a Release artifact with non-canonical metadata', () => {
    const root = tempDirectory();
    const appDirectory = writeReleaseArtifactFixture(
      root,
      'const apiUrl = "https://api.railway.test/api/v1"; appEnvironment = "staging";',
    );
    writeFileSync(
      join(appDirectory, 'Info.plist'),
      '<plist><dict><key>CFBundleIdentifier</key><string>wrong.bundle</string><key>CFBundleShortVersionString</key><string>0.1.0</string><key>CFBundleVersion</key><string>1</string></dict></plist>',
    );

    expect(() =>
      assertReleaseBundleArtifact(appDirectory, stagingConfig()),
    ).toThrow('metadata');
  });

  it('keeps artifact verification errors sanitized', () => {
    const root = tempDirectory();
    const appDirectory = writeReleaseArtifactFixture(
      root,
      'const apiUrl = "http://10.42.0.7:3000/api/v1";',
    );

    try {
      assertReleaseBundleArtifact(appDirectory, stagingConfig());
      throw new Error('expected artifact validation to fail');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain('api.railway.test');
      expect(message).not.toContain('10.42.0.7');
      expect(message).not.toContain(root);
    }
  });

  it('writes an ignored, allowlisted Xcode staging handoff', () => {
    const root = tempDirectory();
    const iosDirectory = join(root, 'apps/mobile/ios');
    mkdirSync(iosDirectory, { recursive: true });

    const handoffPath = writeStagingReleaseXcodeEnvironmentFile(
      iosDirectory,
      root,
      stagingConfig(),
      { isIgnored: () => true, isTracked: () => false },
      '/node/bin/node',
    );
    const handoff = readFileSync(handoffPath, 'utf8');

    expect(handoff).toContain('unset EXPO_NO_CLIENT_ENV_VARS');
    expect(handoff).toContain("export EXPO_NO_DOTENV='1'");
    expect(handoff).toContain("export EXPO_PUBLIC_APP_ENV='staging'");
    expect(handoff).not.toContain('DATABASE_URL');
    expect(handoff).not.toContain('SKIP_BUNDLING');
    expect(handoff).not.toMatch(/^export (?:PATH|DATABASE_URL)=/m);
  });

  it('selects the newest non-symlinked Release artifact without printing paths', () => {
    const root = tempDirectory();
    const older = join(
      root,
      'DerivedData/Older/Build/Products/Release-iphoneos/FoodTracker.app',
    );
    const newer = join(
      root,
      'DerivedData/Newer/Build/Products/Release-iphoneos/FoodTracker.app',
    );
    mkdirSync(older, { recursive: true });
    mkdirSync(newer, { recursive: true });
    const olderTime = new Date('2026-01-01T00:00:00Z');
    const newerTime = new Date('2026-01-02T00:00:00Z');
    utimesSync(older, olderTime, olderTime);
    utimesSync(newer, newerTime, newerTime);

    expect(findNewestReleaseArtifact(join(root, 'DerivedData'))).toBe(newer);
  });

  it('refuses artifact verification when no Release product exists', () => {
    const root = tempDirectory();

    expect(() => findNewestReleaseArtifact(root)).toThrow(
      'No Release-iphoneos FoodTracker artifact was found',
    );
  });

  it('accepts Expo property-driven static framework linkage', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root, {
      staticFrameworks: staticFrameworkFixture(),
    });

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      ),
    ).not.toThrow();
  });

  it('rejects generated Pod targets below the canonical iOS deployment target', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root);
    writePodsProjectFixture(root, ['9.0', '10.0', '12.0', '12.4']);

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      ),
    ).toThrow('deployment target');
  });

  it('accepts ordinary, privacy, and resource Pod targets at 16.4', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root);
    writePodsProjectFixture(root, ['16.4', '16.4', '16.4']);

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      ),
    ).not.toThrow();
  });

  it.each([
    {
      name: 'missing properties file',
      options: { includePropertiesFile: false },
      message: 'static framework properties file',
    },
    {
      name: 'missing ios.useFrameworks property',
      options: { properties: '{}' },
      message: 'ios.useFrameworks',
    },
    {
      name: 'dynamic framework property',
      options: { properties: '{"ios.useFrameworks":"dynamic"}' },
      message: 'static framework linkage',
    },
    {
      name: 'malformed properties JSON',
      options: { properties: '{not-json' },
      message: 'static framework properties file',
    },
    {
      name: 'property not used by FoodTracker target',
      options: {
        podfile: `require 'json'
podfile_properties = JSON.parse(File.read(File.join(__dir__, 'Podfile.properties.json'))) rescue {}
target 'OtherTarget' do
  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
end
`,
      },
      message: 'FoodTracker target',
    },
    {
      name: 'properties file not loaded',
      options: {
        podfile: `target 'FoodTracker' do
  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
end
`,
      },
      message: 'does not load static framework properties',
    },
    {
      name: 'unconditional dynamic override',
      options: {
        podfile: `require 'json'
podfile_properties = JSON.parse(File.read(File.join(__dir__, 'Podfile.properties.json'))) rescue {}
target 'FoodTracker' do
  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
  use_frameworks! :linkage => :dynamic
end
`,
      },
      message: 'dynamic framework override',
    },
    {
      name: 'missing Firebase native pods',
      options: { podfileLock: 'PODS:\n  - ExpoModulesCore\n' },
      message: 'Firebase native pod integration',
    },
  ])(
    'rejects unsafe static framework configuration: $name',
    ({ options, message }) => {
      const root = tempDirectory();
      writeGeneratedReleaseFixture(root, {
        staticFrameworks: staticFrameworkFixture(options),
      });

      expect(() =>
        validateGeneratedReleaseConfiguration(
          join(root, 'apps/mobile/ios'),
          stagingConfig(),
        ),
      ).toThrow(message);
    },
  );

  it('rejects dynamic USE_FRAMEWORKS overrides without printing values', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root, {
      staticFrameworks: staticFrameworkFixture(),
    });

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
        { USE_FRAMEWORKS: 'dynamic' },
      ),
    ).toThrow('dynamic framework override');
  });

  it.each([
    {
      name: 'missing target phase',
      options: { targetHasPhase: false },
      message: 'missing the React Native bundle build phase',
    },
    {
      name: 'bundle phase owned by another target',
      options: { targetHasPhase: false, wrongTargetOwnsPhase: true },
      message: 'missing the React Native bundle build phase',
    },
    {
      name: 'missing phase definition',
      options: { includePhase: false },
      message: 'missing the React Native bundle build phase',
    },
    {
      name: 'missing React Native bundling script',
      options: { phaseScript: 'export BUNDLE_COMMAND="export:embed"' },
      message: 'does not invoke React Native bundling',
    },
    {
      name: 'Release skip flag',
      options: {
        phaseScript: [
          'source .xcode.env',
          'export PROJECT_ROOT="$PROJECT_DIR"/..',
          'if [[ "$CONFIGURATION" = *Debug* ]]; then',
          '  export SKIP_BUNDLING=1',
          'fi',
          'if [[ "$CONFIGURATION" != *Debug* ]]; then',
          '  unset SKIP_BUNDLING',
          'fi',
          'export SKIP_BUNDLING=1',
          'export ENTRY_FILE="expo/scripts/resolveAppEntry"',
          'export CLI_PATH="@expo/cli"',
          'export BUNDLE_COMMAND="export:embed"',
          'react-native-xcode.sh',
        ].join('\n'),
      },
      message: 'skips bundling outside Debug',
    },
    {
      name: 'inherited Release skip boundary',
      options: {
        phaseScript: [
          'source .xcode.env',
          'if [[ "$CONFIGURATION" = *Debug* ]]; then',
          '  export SKIP_BUNDLING=1',
          'fi',
          'export ENTRY_FILE="resolveAppEntry"',
          'export CLI_PATH="@expo/cli"',
          'export BUNDLE_COMMAND="export:embed"',
          'react-native-xcode.sh',
        ].join('\n'),
      },
      message: 'does not clear inherited skip flags',
    },
    {
      name: 'disabled build phase',
      options: { buildActionMask: '0' },
      message: 'malformed or disabled',
    },
    {
      name: 'postprocessing-only bundle phase',
      options: { runOnlyForDeploymentPostprocessing: '1' },
      message: 'malformed or disabled',
    },
  ])('rejects $name bundle configuration', ({ options, message }) => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root, {
      bundleProject: bundleProjectFixture(options),
    });

    expect(() =>
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      ),
    ).toThrow(message);
  });

  it('keeps bundle-guard errors sanitized', () => {
    const root = tempDirectory();
    writeGeneratedReleaseFixture(root, {
      bundleProject: bundleProjectFixture({ targetHasPhase: false }),
    });

    try {
      validateGeneratedReleaseConfiguration(
        join(root, 'apps/mobile/ios'),
        stagingConfig(),
      );
      throw new Error('expected bundle validation to fail');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain('api.railway.test');
      expect(message).not.toContain('GoogleService-Info.plist');
      expect(message).not.toContain(root);
    }
  });

  it('orders prebuild, pods, and Xcode handoff', () => {
    const commands = buildPreparationCommands('/repo');
    expect(commands.map((command) => command.command)).toEqual([
      'corepack',
      'corepack',
      'pod',
      'open',
    ]);
    expect(commands[0]?.args).toEqual([
      'pnpm',
      '--filter',
      '@food-tracker/shared',
      'build',
    ]);
    expect(commands[1]?.args).toContain('--clean');
    expect(commands[1]?.args).toContain('--no-install');
    expect(commands[2]?.args).toEqual(['install', '--repo-update']);
    expect(commands[3]?.args).toEqual([
      '-a',
      'Xcode',
      '/repo/apps/mobile/ios/FoodTracker.xcworkspace',
    ]);
  });

  it('refuses tracked, non-ignored, or symlinked native state', () => {
    const root = tempDirectory();
    const ios = join(root, 'apps/mobile/ios');
    mkdirSync(ios, { recursive: true });
    expect(() =>
      assertSafeGeneratedIosDirectory(ios, root, {
        isIgnored: () => false,
        isTracked: () => false,
      }),
    ).toThrow('not ignored');
    expect(() =>
      assertSafeGeneratedIosDirectory(ios, root, {
        isIgnored: () => true,
        isTracked: () => true,
      }),
    ).toThrow('tracked');

    rmSync(ios, { recursive: true, force: true });
    mkdirSync(join(root, 'apps/mobile'), { recursive: true });
    symlinkSync(join(root, 'apps/mobile'), ios, 'dir');
    expect(() =>
      assertSafeGeneratedIosDirectory(ios, root, {
        isIgnored: () => true,
        isTracked: () => false,
      }),
    ).toThrow('symlink');
  });

  it('cleanup removes only generated iOS state and preserves unrelated files', () => {
    const root = tempDirectory();
    const ios = join(root, 'apps/mobile/ios');
    const unrelated = join(root, 'unrelated.txt');
    mkdirSync(ios, { recursive: true });
    mkdirSync(join(ios, 'FoodTracker.xcworkspace'), { recursive: true });
    writeFileSync(join(ios, '.gitignore'), 'generated');
    writeFileSync(unrelated, 'keep');
    cleanupGeneratedIosDirectory(root, {
      isIgnored: () => true,
      isTracked: () => false,
    });
    expect(() => accessSync(ios)).toThrow();
    expect(readFileSync(unrelated, 'utf8')).toBe('keep');
  });

  it('requires a connected physical iPhone rather than a simulator record', () => {
    expect(
      hasConnectedPhysicalIPhone('iPhone 17 Pro (Shutdown) (Simulator)'),
    ).toBe(false);
    expect(hasConnectedPhysicalIPhone('iPhone 17 Pro (connected)')).toBe(true);
    expect(hasConnectedPhysicalIPhone('iPad (connected)')).toBe(false);
    expect(
      hasConnectedPhysicalIPhone(
        JSON.stringify([
          {
            simulator: true,
            available: true,
            name: 'iPhone Simulator',
            platform: 'com.apple.platform.iphonesimulator',
          },
          {
            simulator: false,
            available: true,
            name: 'Josh iPhone',
            platform: 'com.apple.platform.iphoneos',
          },
        ]),
      ),
    ).toBe(true);
  });

  it('opens Xcode only after automated guards and generated-state checks pass', () => {
    const root = tempDirectory();
    const mobile = join(root, 'apps/mobile');
    mkdirSync(mobile, { recursive: true });
    const plistPath = join(root, 'external.plist');
    writeFileSync(
      plistPath,
      '<plist><dict><key>BUNDLE_ID</key><string>ca.joshuaaryeetey.foodtracker</string><key>PROJECT_ID</key><string>project</string><key>GOOGLE_APP_ID</key><string>app</string><key>CLIENT_ID</key><string>client</string><key>REVERSED_CLIENT_ID</key><string>com.googleusercontent.apps.release</string><key>API_KEY</key><string>key</string></dict></plist>',
    );
    writeFileSync(
      join(mobile, '.env.staging-release.local'),
      `APP_ENV=staging\nRAILWAY_STAGING_API_HOST=api.railway.test\nEXPO_PUBLIC_APP_ENV=staging\nEXPO_PUBLIC_API_URL=https://api.railway.test/api/v1\nEXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=false\nEXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=web\nGOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.release\nGOOGLE_SERVICES_PLIST_PATH=${plistPath}\nEXPO_NO_DOTENV=1\n`,
    );
    const order: string[] = [];
    const writeGenerated = (): void => writeGeneratedReleaseFixture(root);
    const captureCommand = (_command: string, args: string[]): string =>
      args[0] === 'branch' ? 'phase-17-free-xcode-standalone\n' : '';
    const runCommand = (command: string): void => {
      order.push(command);
      if (command === 'corepack') writeGenerated();
    };
    runStagingReleasePreparation({
      rootDir: root,
      envFilePath: join(mobile, '.env.staging-release.local'),
      skipToolchainChecks: true,
      captureCommand,
      runCommand,
      readStatus: () => 'dirty',
      isIgnored: () => true,
      isTracked: () => false,
    });
    expect(order).toEqual(['corepack', 'corepack', 'pod', 'open']);
    const handoff = readFileSync(
      join(root, 'apps/mobile/ios/.xcode.env.local'),
      'utf8',
    );
    expect(handoff).toContain("export EXPO_PUBLIC_APP_ENV='staging'");
    expect(handoff).toContain('unset EXPO_NO_CLIENT_ENV_VARS');
  });

  it('does not forward an inherited bundle-skip flag to the Release Xcode handoff', () => {
    const root = tempDirectory();
    const mobile = join(root, 'apps/mobile');
    mkdirSync(mobile, { recursive: true });
    const plistPath = join(root, 'external.plist');
    writeFileSync(
      plistPath,
      '<plist><dict><key>BUNDLE_ID</key><string>ca.joshuaaryeetey.foodtracker</string><key>PROJECT_ID</key><string>project</string><key>GOOGLE_APP_ID</key><string>app</string><key>CLIENT_ID</key><string>client</string><key>REVERSED_CLIENT_ID</key><string>com.googleusercontent.apps.release</string><key>API_KEY</key><string>key</string></dict></plist>',
    );
    writeFileSync(
      join(mobile, '.env.staging-release.local'),
      `APP_ENV=staging\nRAILWAY_STAGING_API_HOST=api.railway.test\nEXPO_PUBLIC_APP_ENV=staging\nEXPO_PUBLIC_API_URL=https://api.railway.test/api/v1\nEXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=false\nEXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=web\nGOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.release\nGOOGLE_SERVICES_PLIST_PATH=${plistPath}\nEXPO_NO_DOTENV=1\n`,
    );
    const capturedEnvironments: NodeJS.ProcessEnv[] = [];
    const originalSkipBundling = process.env.SKIP_BUNDLING;
    process.env.SKIP_BUNDLING = '1';
    try {
      runStagingReleasePreparation({
        rootDir: root,
        envFilePath: join(mobile, '.env.staging-release.local'),
        skipToolchainChecks: true,
        captureCommand: (command, args) =>
          args[0] === 'branch' ? 'phase-17-free-xcode-standalone\n' : '',
        runCommand: (command, _args, _cwd, environment) => {
          if (command === 'open') capturedEnvironments.push(environment);
          if (command === 'corepack') writeGeneratedReleaseFixture(root);
        },
        readStatus: () => 'dirty',
        isIgnored: () => true,
        isTracked: () => false,
      });
    } finally {
      if (originalSkipBundling === undefined) {
        delete process.env.SKIP_BUNDLING;
      } else {
        process.env.SKIP_BUNDLING = originalSkipBundling;
      }
    }
    expect(capturedEnvironments).toHaveLength(1);
    expect(capturedEnvironments[0]?.SKIP_BUNDLING).toBeUndefined();
  });
});
