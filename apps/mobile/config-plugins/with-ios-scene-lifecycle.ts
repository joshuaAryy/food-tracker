import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
  type ConfigPlugin,
} from 'expo/config-plugins';

const SCENE_MARKER = '// @generated begin Food Tracker iOS scene lifecycle';

type InfoPlist = Record<string, unknown>;

type XcodeProject = {
  hash: {
    project: {
      objects: {
        PBXGroup?: Record<string, { name?: string }>;
      };
    };
  };
  pbxTargetByName: (name: string) => { uuid: string } | null;
  getFirstTarget: () => { uuid: string };
  hasFile: (path: string) => boolean;
  addSourceFile: (
    path: string,
    options: { target: string },
    group: string,
  ) => unknown;
};

export function ensureApplicationSceneManifest(
  infoPlist: InfoPlist,
): InfoPlist {
  return {
    ...infoPlist,
    UIApplicationSceneManifest: {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    },
  };
}

const SCENE_CONFIGURATION_METHOD = `${SCENE_MARKER}
  public func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(
      name: "Default Configuration",
      sessionRole: connectingSceneSession.role
    )
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }
// @generated end Food Tracker iOS scene lifecycle`;

export function applySceneLifecycleToAppDelegate(contents: string): string {
  if (contents.includes(SCENE_MARKER)) return contents;
  if (!/class\s+AppDelegate\s*:\s*ExpoAppDelegate\b/.test(contents)) {
    throw new Error(
      'Generated AppDelegate is missing the Expo application delegate.',
    );
  }

  const withoutWindowCreation = contents.replace(
    /^\s*window\s*=\s*UIWindow\(frame:\s*UIScreen\.main\.bounds\)\s*\n/m,
    '',
  );
  const withoutFactoryStart = withoutWindowCreation.replace(
    /^\s*factory\.startReactNative\([\s\S]*?launchOptions:\s*launchOptions\)\s*$/m,
    '\n',
  );
  if (withoutFactoryStart.includes('factory.startReactNative(')) {
    throw new Error(
      'Generated AppDelegate has an unsupported React Native startup form.',
    );
  }

  const insertionMarker = '  // Linking API';
  const insertionIndex = withoutFactoryStart.indexOf(insertionMarker);
  if (insertionIndex < 0) {
    throw new Error('Generated AppDelegate is missing its linking section.');
  }
  return `${withoutFactoryStart.slice(0, insertionIndex)}${SCENE_CONFIGURATION_METHOD}\n\n${withoutFactoryStart.slice(insertionIndex)}`;
}

export function createSceneDelegateSource(): string {
  return `internal import Expo
import React
import UIKit

${SCENE_MARKER}
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  private var didStartReactNative = false

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    if !didStartReactNative {
      didStartReactNative = true
      factory.startReactNative(
        withModuleName: "main",
        in: window,
        launchOptions: nil
      )
    }

    for context in connectionOptions.urlContexts {
      handle(url: context.url)
    }
    for userActivity in connectionOptions.userActivities {
      handle(userActivity: userActivity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      handle(url: context.url)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    handle(userActivity: userActivity)
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationDidEnterBackground(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationWillEnterForeground(UIApplication.shared)
  }

  private func handle(url: URL) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }
    _ = appDelegate.application(UIApplication.shared, open: url, options: [:])
  }

  private func handle(userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }
    _ = appDelegate.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }
}
// @generated end Food Tracker iOS scene lifecycle
`;
}

function foodTrackerGroupKey(project: XcodeProject): string | undefined {
  const groups = project.hash.project.objects.PBXGroup;
  if (groups === undefined) return undefined;
  return Object.entries(groups).find(
    ([key, group]) => !key.endsWith('_comment') && group.name === 'FoodTracker',
  )?.[0];
}

export function addSceneDelegateToXcodeProject(
  project: XcodeProject,
): XcodeProject {
  const target =
    project.pbxTargetByName('FoodTracker') ?? project.getFirstTarget();
  if (target === null || target === undefined) {
    throw new Error(
      'Generated Xcode project is missing the FoodTracker target.',
    );
  }
  if (project.hasFile('FoodTracker/SceneDelegate.swift')) return project;
  const group = foodTrackerGroupKey(project);
  if (group === undefined) {
    throw new Error(
      'Generated Xcode project is missing the FoodTracker source group.',
    );
  }
  project.addSourceFile(
    'FoodTracker/SceneDelegate.swift',
    { target: target.uuid },
    group,
  );
  return project;
}

const withIosSceneLifecycle: ConfigPlugin = (config) => {
  config = withInfoPlist(config, (config) => {
    config.modResults = ensureApplicationSceneManifest(config.modResults);
    return config;
  });

  config = withAppDelegate(config, (config) => {
    config.modResults.contents = applySceneLifecycleToAppDelegate(
      config.modResults.contents,
    );
    return config;
  });

  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const sceneDelegatePath = join(
        config.modRequest.platformProjectRoot,
        'FoodTracker',
        'SceneDelegate.swift',
      );
      mkdirSync(join(config.modRequest.platformProjectRoot, 'FoodTracker'), {
        recursive: true,
      });
      writeFileSync(sceneDelegatePath, createSceneDelegateSource(), 'utf8');
      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    addSceneDelegateToXcodeProject(config.modResults);
    return config;
  });

  return config;
};

export default withIosSceneLifecycle;
